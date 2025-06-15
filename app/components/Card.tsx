type CardProps = {
  title: string;
  children: React.ReactNode;
  bg?: string;
};

export default function Card({ title, children, bg = 'bg-gray-800' }: CardProps) {
  return (
    <section className={`rounded-xl border border-gray-700/40 p-4 shadow-sm ${bg}`}>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
