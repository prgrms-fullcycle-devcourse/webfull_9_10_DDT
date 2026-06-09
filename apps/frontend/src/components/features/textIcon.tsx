export const TextIcon = ({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) => {
  return (
    <div className="flex flex-col items-center text-center space-y-2">
      {icon}
      <p className="text-[12px] font-bold">{title}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
    </div>
  );
};