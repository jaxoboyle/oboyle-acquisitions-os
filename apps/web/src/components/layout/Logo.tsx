import Image from "next/image";

export function Logo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/branding/logo-mark.png"
        alt=""
        width={46}
        height={32}
        className="shrink-0 object-contain"
      />
      <div className="leading-none">
        <div className="font-serif font-semibold text-text text-[15px] tracking-tight whitespace-nowrap">
          O&apos;Boyle Acquisition
        </div>
        <div className="label-tech mt-0.5">Operating System</div>
      </div>
    </div>
  );
}
