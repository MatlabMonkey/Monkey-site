type CardProps = {
  title: string;
  children: React.ReactNode;
  bg?: string;
  textColor?: string; // NEW
};

export default function Card({ title, children, bg = 'bg-gray-800', textColor = 'text-black' }: CardProps) {
  return (
    <section className={`rounded-xl border border-gray-700/40 p-4 shadow-sm ${bg} ${textColor}`}>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
