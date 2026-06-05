use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::{
    env, fs,
    path::{Path, PathBuf},
    process::Command,
    time::Instant,
};
use tauri::{AppHandle, Manager};
use thiserror::Error;

#[derive(Debug, Error)]
enum CommandError {
    #[error("falha de IO: {0}")]
    Io(#[from] std::io::Error),
    #[error("falha de serializacao: {0}")]
    Json(#[from] serde_json::Error),
    #[error("diretorio de dados da aplicacao indisponivel")]
    MissingAppDataDir,
}

impl Serialize for CommandError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Serialize, Deserialize)]
struct ExportPayload {
    document: serde_json::Value,
    tex: String,
    #[serde(rename = "exportedAt")]
    exported_at: String,
}

#[derive(Debug, Serialize)]
struct PdfCompileResult {
    pdf_path: Option<String>,
    diagnostics: Vec<String>,
}

struct ResolvedLatexProgram {
    command: PathBuf,
    path_dir: Option<PathBuf>,
    diagnostics: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PreviewProjectFile {
    path: String,
    kind: String,
    content: Option<String>,
    binary_base64: Option<String>,
}

#[tauri::command]
fn save_tex_document(app: AppHandle, tex: String) -> Result<PathBuf, CommandError> {
    let exports_dir = ensure_exports_dir(&app)?;
    let file_path = exports_dir.join("documento.tex");
    fs::write(&file_path, tex)?;
    Ok(file_path)
}

#[tauri::command]
fn save_json_document(app: AppHandle, payload: ExportPayload) -> Result<PathBuf, CommandError> {
    let exports_dir = ensure_exports_dir(&app)?;
    let file_path = exports_dir.join("documento.json");
    let content = serde_json::to_string_pretty(&payload)?;
    fs::write(&file_path, content)?;
    Ok(file_path)
}

#[tauri::command]
fn open_json_document(app: AppHandle) -> Result<Option<String>, CommandError> {
    let file_path = ensure_exports_dir(&app)?.join("documento.json");
    if !file_path.exists() {
        return Ok(None);
    }

    Ok(Some(fs::read_to_string(file_path)?))
}

#[tauri::command]
fn open_tex_document(app: AppHandle) -> Result<Option<String>, CommandError> {
    let file_path = ensure_exports_dir(&app)?.join("documento.tex");
    if !file_path.exists() {
        return Ok(None);
    }

    Ok(Some(fs::read_to_string(file_path)?))
}

#[tauri::command]
fn compile_pdf_preview(
    app: AppHandle,
    tex: String,
    main_tex_path: Option<String>,
    project_key: Option<String>,
    compile_mode: Option<String>,
    revision: Option<u64>,
    project_files: Option<Vec<PreviewProjectFile>>,
) -> PdfCompileResult {
    let started_at = Instant::now();
    let compile_mode = compile_mode.unwrap_or_else(|| "preview".to_string());
    let tex = if compile_mode == "preview" {
        create_fast_preview_tex(&tex)
    } else {
        tex
    };

    match compile_pdf_with_local_toolchain(
        &app,
        &tex,
        main_tex_path.as_deref(),
        project_key.as_deref(),
        &compile_mode,
        revision,
        project_files.unwrap_or_default(),
    ) {
        Ok(pdf_path) => {
            let diagnostics = vec![
                "PDF compilado com toolchain LaTeX local.".to_string(),
                format!("Arquivo gerado: {}", pdf_path.to_string_lossy()),
                format!(
                    "Tempo total backend Tauri: {:.1}ms.",
                    started_at.elapsed().as_secs_f64() * 1000.0
                ),
            ];

            PdfCompileResult {
                pdf_path: Some(pdf_path.to_string_lossy().to_string()),
                diagnostics,
            }
        }
        Err(diagnostics) => PdfCompileResult {
            pdf_path: None,
            diagnostics,
        },
    }
}

fn ensure_exports_dir(app: &AppHandle) -> Result<PathBuf, CommandError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|_| CommandError::MissingAppDataDir)?
        .join("exports");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn compile_pdf_with_local_toolchain(
    app: &AppHandle,
    tex: &str,
    main_tex_path: Option<&str>,
    project_key: Option<&str>,
    compile_mode: &str,
    revision: Option<u64>,
    project_files: Vec<PreviewProjectFile>,
) -> Result<PathBuf, Vec<String>> {
    let total_started_at = Instant::now();
    let preview_dir = match app.path().app_cache_dir() {
        Ok(dir) => dir.join("preview-cache").join(format!(
            "{}-{}",
            sanitize_cache_key(project_key.unwrap_or("standalone")),
            sanitize_cache_key(compile_mode)
        )),
        Err(_) => {
            return Err(vec![
                "Diretorio de cache da aplicacao indisponivel.".to_string()
            ])
        }
    };

    if let Err(error) = fs::create_dir_all(&preview_dir) {
        return Err(vec![format!(
            "Falha ao criar diretorio de preview: {error}"
        )]);
    }

    let main_relative_path = main_tex_path
        .map(|path| normalize_project_relative_path(path, Path::new("")))
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| PathBuf::from("main.tex"));
    let compile_relative_path = if compile_mode == "preview" {
        create_preview_tex_path(&main_relative_path, revision)
    } else {
        main_relative_path.clone()
    };
    let tex_path = preview_dir.join(&compile_relative_path);
    if let Some(parent) = tex_path.parent() {
        if let Err(error) = fs::create_dir_all(parent) {
            return Err(vec![format!(
                "Falha ao criar diretorio do TEX principal: {error}"
            )]);
        }
    }
    let write_started_at = Instant::now();
    if let Err(error) = write_text_if_changed(&tex_path, tex) {
        return Err(vec![format!("Falha ao salvar TEX temporario: {error}")]);
    }

    let mut diagnostics = write_project_files(&preview_dir, main_tex_path, project_files);
    diagnostics.push(format!(
        "Tempo escrita temporarios: {:.1}ms.",
        write_started_at.elapsed().as_secs_f64() * 1000.0
    ));
    diagnostics.push(format!(
        "Cache de compilacao: {}",
        preview_dir.to_string_lossy()
    ));
    if compile_mode == "preview" {
        diagnostics.push("Preview rapido: compilador direto, duas passadas para atualizar sumario, com flag \\fastpreviewtrue.".to_string());
    }

    let compile_dir = tex_path.parent().unwrap_or(&preview_dir);
    let compile_tex_path = tex_path
        .file_name()
        .map(PathBuf::from)
        .unwrap_or_else(|| main_relative_path.clone());
    remove_generated_latex_artifacts(compile_dir, tex_path.file_stem());

    let compile_started_at = Instant::now();
    let attempts = create_latex_attempts(app, tex, compile_dir, &compile_tex_path, compile_mode);
    for attempt in attempts {
        match attempt {
            CompileAttempt::Success(message) => {
                if let Some(pdf_path) = find_compiled_pdf(&preview_dir, &tex_path) {
                    diagnostics.push(format!(
                        "Tempo compilacao LaTeX: {:.1}ms.",
                        compile_started_at.elapsed().as_secs_f64() * 1000.0
                    ));
                    diagnostics.push(format!(
                        "Tempo total backend preview: {:.1}ms.",
                        total_started_at.elapsed().as_secs_f64() * 1000.0
                    ));
                    return Ok(pdf_path);
                }
                diagnostics.push(format!("{message}, mas o PDF gerado nao foi encontrado."));
            }
            CompileAttempt::Failed(messages) => {
                diagnostics.extend(messages);
            }
        }
    }

    diagnostics.push(
        "Nenhum compilador local conseguiu gerar PDF. Configure EDITORTEX_LATEX_BIN/EDITORTEX_LATEX_HOME, inclua um runtime em latex-runtime/bin nos resources do app ou instale latexmk/pdflatex no PATH.".to_string(),
    );
    Err(diagnostics)
}

fn find_compiled_pdf(preview_dir: &Path, tex_path: &Path) -> Option<PathBuf> {
    let expected_next_to_tex = tex_path.with_extension("pdf");
    if expected_next_to_tex.exists() {
        return Some(expected_next_to_tex);
    }

    let file_stem = tex_path.file_stem()?;
    let expected_in_workdir = preview_dir.join(file_stem).with_extension("pdf");
    if expected_in_workdir.exists() {
        return Some(expected_in_workdir);
    }

    find_pdf_by_stem(preview_dir, file_stem)
}

fn find_pdf_by_stem(dir: &Path, file_stem: &std::ffi::OsStr) -> Option<PathBuf> {
    let entries = fs::read_dir(dir).ok()?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            if let Some(pdf_path) = find_pdf_by_stem(&path, file_stem) {
                return Some(pdf_path);
            }
            continue;
        }

        let is_matching_pdf = path
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("pdf"))
            && path.file_stem().is_some_and(|stem| stem == file_stem);
        if is_matching_pdf {
            return Some(path);
        }
    }

    None
}

fn write_project_files(
    preview_dir: &Path,
    main_tex_path: Option<&str>,
    project_files: Vec<PreviewProjectFile>,
) -> Vec<String> {
    let mut diagnostics = Vec::new();
    let normalized_main_path =
        main_tex_path.map(|path| normalize_project_relative_path(path, Path::new("")));

    for file in project_files {
        if file.kind == "pdf" || file.kind == "auxiliary" {
            continue;
        }

        let relative_path = normalize_project_relative_path(&file.path, Path::new(""));
        if normalized_main_path
            .as_ref()
            .is_some_and(|main_path| main_path == &relative_path)
        {
            continue;
        }
        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let target_path = preview_dir.join(relative_path);
        if !target_path.starts_with(preview_dir) {
            diagnostics.push(format!(
                "Arquivo ignorado por caminho invalido: {}",
                file.path
            ));
            continue;
        }

        if let Some(parent) = target_path.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                diagnostics.push(format!(
                    "Falha ao criar pasta de asset {}: {error}",
                    file.path
                ));
                continue;
            }
        }

        let write_result = if let Some(content) = file.content {
            write_text_if_changed(&target_path, &content)
        } else if let Some(binary_base64) = file.binary_base64 {
            match general_purpose::STANDARD.decode(binary_base64) {
                Ok(bytes) => write_bytes_if_changed(&target_path, &bytes),
                Err(error) => {
                    diagnostics.push(format!("Falha ao decodificar asset {}: {error}", file.path));
                    continue;
                }
            }
        } else {
            continue;
        };

        if let Err(error) = write_result {
            diagnostics.push(format!("Falha ao salvar asset {}: {error}", file.path));
        }
    }

    diagnostics
}

fn write_text_if_changed(path: &Path, content: &str) -> std::io::Result<()> {
    write_bytes_if_changed(path, content.as_bytes())
}

fn write_bytes_if_changed(path: &Path, content: &[u8]) -> std::io::Result<()> {
    if let Ok(existing) = fs::read(path) {
        if existing == content {
            return Ok(());
        }
    }

    fs::write(path, content)
}

fn remove_generated_latex_artifacts(directory: &Path, stem: Option<&std::ffi::OsStr>) {
    let Some(stem) = stem.and_then(|value| value.to_str()) else {
        return;
    };
    let generated_extensions = [
        "aux",
        "bbl",
        "blg",
        "fls",
        "fdb_latexmk",
        "log",
        "lof",
        "lot",
        "nav",
        "out",
        "pdf",
        "snm",
        "synctex.gz",
        "toc",
    ];

    for extension in generated_extensions {
        let target_path = directory.join(format!("{stem}.{extension}"));
        if target_path.starts_with(directory) {
            let _ = fs::remove_file(target_path);
        }
    }
}

fn normalize_project_relative_path(path: &str, main_parent: &Path) -> PathBuf {
    let normalized = path.replace('\\', "/");
    let mut relative = PathBuf::from(&normalized);

    if !main_parent.as_os_str().is_empty() {
        if let Ok(stripped) = Path::new(&normalized).strip_prefix(main_parent) {
            relative = stripped.to_path_buf();
        }
    }

    let mut safe_relative = PathBuf::new();
    for component in relative.components() {
        if let std::path::Component::Normal(value) = component {
            safe_relative.push(value);
        }
    }

    safe_relative
}

enum CompileAttempt {
    Success(String),
    Failed(Vec<String>),
}

fn create_latex_attempts(
    app: &AppHandle,
    tex: &str,
    workdir: &Path,
    main_tex_path: &Path,
    compile_mode: &str,
) -> Vec<CompileAttempt> {
    if requires_unicode_engine(tex) {
        if compile_mode == "preview" {
            return vec![
                run_lualatex_passes(app, workdir, main_tex_path, 2),
                run_xelatex_passes(app, workdir, main_tex_path, 2),
            ];
        }

        return vec![
            run_latexmk_lualatex(app, workdir, main_tex_path),
            run_lualatex(app, workdir, main_tex_path),
            run_latexmk_xelatex(app, workdir, main_tex_path),
            run_xelatex(app, workdir, main_tex_path),
        ];
    }

    if compile_mode == "preview" {
        return vec![run_pdflatex_passes(app, workdir, main_tex_path, 2)];
    }

    vec![
        run_latexmk_pdflatex(app, workdir, main_tex_path),
        run_pdflatex(app, workdir, main_tex_path),
    ]
}

fn requires_unicode_engine(tex: &str) -> bool {
    tex.contains("\\usepackage{fontspec}")
        || tex.contains("\\usepackage[") && tex.contains("]{fontspec}")
        || tex.contains("\\setmainfont")
        || tex.contains("\\setsansfont")
        || tex.contains("\\setmonofont")
}

fn create_fast_preview_tex(tex: &str) -> String {
    if tex.contains("\\fastpreviewtrue") {
        return tex.to_string();
    }

    let flag = "\\newif\\iffastpreview\n\\fastpreviewtrue\n";
    if let Some(index) = tex.find("\\documentclass") {
        if let Some(line_end) = tex[index..].find('\n') {
            let insert_at = index + line_end + 1;
            let mut next_tex = tex.to_string();
            next_tex.insert_str(insert_at, flag);
            return next_tex;
        }
    }

    tex.to_string()
}

fn create_preview_tex_path(main_relative_path: &Path, revision: Option<u64>) -> PathBuf {
    let mut path = main_relative_path.to_path_buf();
    let file_stem = main_relative_path
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "main".to_string());
    let extension = main_relative_path
        .extension()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| "tex".to_string());
    path.set_file_name(format!(
        "{file_stem}.preview.{}.{extension}",
        revision.unwrap_or(0)
    ));
    path
}

fn run_latexmk_xelatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "latexmk",
        &[
            "-xelatex",
            "-f",
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_latexmk_lualatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "latexmk",
        &[
            "-lualatex",
            "-f",
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_latexmk_pdflatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "latexmk",
        &[
            "-pdf",
            "-f",
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_xelatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "xelatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_xelatex_passes(
    app: &AppHandle,
    workdir: &Path,
    main_tex_path: &Path,
    passes: usize,
) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command_passes(
        app,
        "xelatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
        passes,
    )
}

fn run_lualatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "lualatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_lualatex_passes(
    app: &AppHandle,
    workdir: &Path,
    main_tex_path: &Path,
    passes: usize,
) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command_passes(
        app,
        "lualatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
        passes,
    )
}

fn run_pdflatex(app: &AppHandle, workdir: &Path, main_tex_path: &Path) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command(
        app,
        "pdflatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
    )
}

fn run_pdflatex_passes(
    app: &AppHandle,
    workdir: &Path,
    main_tex_path: &Path,
    passes: usize,
) -> CompileAttempt {
    let main_tex = main_tex_path.to_string_lossy();
    run_command_passes(
        app,
        "pdflatex",
        &[
            "-interaction=nonstopmode",
            "-halt-on-error",
            main_tex.as_ref(),
        ],
        workdir,
        passes,
    )
}

fn run_command_passes(
    app: &AppHandle,
    program: &str,
    args: &[&str],
    workdir: &Path,
    passes: usize,
) -> CompileAttempt {
    let mut diagnostics = Vec::new();

    for pass in 1..=passes {
        match run_command(app, program, args, workdir) {
            CompileAttempt::Success(message) => {
                diagnostics.push(format!("Passada {pass}/{passes}: {message}"));
            }
            CompileAttempt::Failed(messages) => {
                diagnostics.push(format!("Passada {pass}/{passes} falhou."));
                diagnostics.extend(messages);
                return CompileAttempt::Failed(diagnostics);
            }
        }
    }

    CompileAttempt::Success(diagnostics.join("\n"))
}

fn run_command(app: &AppHandle, program: &str, args: &[&str], workdir: &Path) -> CompileAttempt {
    let resolved_program = resolve_latex_program(app, program);
    let mut command = Command::new(&resolved_program.command);
    command.args(args).current_dir(workdir);
    if let Some(path_dir) = &resolved_program.path_dir {
        let next_path = prepend_path(path_dir);
        command.env("PATH", next_path);
    }
    let output = command.output();

    match output {
        Ok(output) if output.status.success() => {
            let mut diagnostics = resolved_program.diagnostics;
            diagnostics.push(format!("{program} executado com sucesso"));
            CompileAttempt::Success(diagnostics.join("\n"))
        }
        Ok(output) => {
            let mut diagnostics = resolved_program.diagnostics;
            diagnostics.extend([
                format!("{program} retornou codigo de erro."),
                String::from_utf8_lossy(&output.stderr).trim().to_string(),
                String::from_utf8_lossy(&output.stdout).trim().to_string(),
            ]);
            CompileAttempt::Failed(diagnostics)
        }
        Err(error) => {
            let mut diagnostics = resolved_program.diagnostics;
            diagnostics.push(format!("{program} indisponivel: {error}"));
            CompileAttempt::Failed(diagnostics)
        }
    }
}

fn resolve_latex_program(app: &AppHandle, program: &str) -> ResolvedLatexProgram {
    let mut diagnostics = Vec::new();
    if let Some(resolved) = resolve_manual_latex_program(program, &mut diagnostics) {
        return resolved;
    }

    if let Some(resolved) = resolve_bundled_latex_program(app, program, &mut diagnostics) {
        return resolved;
    }

    diagnostics.push(format!("Toolchain LaTeX: tentando {program} pelo PATH."));
    ResolvedLatexProgram {
        command: PathBuf::from(program),
        path_dir: None,
        diagnostics,
    }
}

fn resolve_manual_latex_program(
    program: &str,
    diagnostics: &mut Vec<String>,
) -> Option<ResolvedLatexProgram> {
    let mut candidates = Vec::new();
    if let Ok(manual_bin) = env::var("EDITORTEX_LATEX_BIN") {
        candidates.push(PathBuf::from(manual_bin));
    }
    if let Ok(manual_home) = env::var("EDITORTEX_LATEX_HOME") {
        let manual_home = PathBuf::from(manual_home);
        candidates.push(manual_home.join("bin"));
        candidates.push(manual_home.join("bin").join(platform_bin_name()));
        candidates.push(manual_home);
    }

    for candidate in candidates {
        match resolve_program_candidate(&candidate, program) {
            Some(command) => {
                diagnostics.push(format!(
                    "Toolchain LaTeX: usando {program} manual em {}.",
                    command.to_string_lossy()
                ));
                return Some(ResolvedLatexProgram {
                    path_dir: command.parent().map(Path::to_path_buf),
                    command,
                    diagnostics: diagnostics.clone(),
                });
            }
            None => diagnostics.push(format!(
                "Toolchain LaTeX manual: {program} nao encontrado em {}.",
                candidate.to_string_lossy()
            )),
        }
    }

    None
}

fn resolve_bundled_latex_program(
    app: &AppHandle,
    program: &str,
    diagnostics: &mut Vec<String>,
) -> Option<ResolvedLatexProgram> {
    for directory in bundled_latex_bin_directories(app) {
        let Some(command) = resolve_program_candidate(&directory, program) else {
            continue;
        };

        diagnostics.push(format!(
            "Toolchain LaTeX: usando {program} embutido em {}.",
            command.to_string_lossy()
        ));
        return Some(ResolvedLatexProgram {
            path_dir: command.parent().map(Path::to_path_buf),
            command,
            diagnostics: diagnostics.clone(),
        });
    }

    diagnostics
        .push("Toolchain LaTeX embutido: runtime nao encontrado nos resources do app.".to_string());
    None
}

fn bundled_latex_bin_directories(app: &AppHandle) -> Vec<PathBuf> {
    let mut directories = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        directories.push(resource_dir.join("latex-runtime").join("bin"));
        directories.push(
            resource_dir
                .join("latex-runtime")
                .join("bin")
                .join(platform_bin_name()),
        );
    }
    directories
}

fn resolve_program_candidate(candidate: &Path, program: &str) -> Option<PathBuf> {
    if candidate.is_file() {
        return is_program_file(candidate, program).then(|| candidate.to_path_buf());
    }

    if !candidate.is_dir() {
        return None;
    }

    let executable_path = candidate.join(format!("{program}{}", executable_suffix()));
    if executable_path.is_file() {
        return Some(executable_path);
    }

    let extensionless_path = candidate.join(program);
    if extensionless_path.is_file() {
        return Some(extensionless_path);
    }

    None
}

fn is_program_file(file_path: &Path, program: &str) -> bool {
    let Some(file_name) = file_path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    file_name.eq_ignore_ascii_case(program)
        || file_name.eq_ignore_ascii_case(&format!("{program}{}", executable_suffix()))
}

fn prepend_path(directory: &Path) -> String {
    let mut paths = vec![directory.to_path_buf()];
    if let Some(current_path) = env::var_os("PATH") {
        paths.extend(env::split_paths(&current_path));
    }

    env::join_paths(paths)
        .unwrap_or_default()
        .to_string_lossy()
        .to_string()
}

fn executable_suffix() -> &'static str {
    if cfg!(windows) {
        ".exe"
    } else {
        ""
    }
}

fn platform_bin_name() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn sanitize_cache_key(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric()
                || character == '.'
                || character == '_'
                || character == '-'
            {
                character
            } else {
                '-'
            }
        })
        .take(80)
        .collect();

    if sanitized.is_empty() {
        "standalone".to_string()
    } else {
        sanitized
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_tex_document,
            save_json_document,
            open_json_document,
            open_tex_document,
            compile_pdf_preview
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar EditorTex");
}
