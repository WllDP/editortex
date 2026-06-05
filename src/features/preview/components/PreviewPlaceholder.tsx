export function PreviewPlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center bg-transparent px-8 text-center text-sm font-medium text-[#94A3B8]">
      {label}
    </div>
  );
}
