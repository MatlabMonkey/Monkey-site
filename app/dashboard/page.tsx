import Card from "../components/Card";

type DashboardCard = {
  title: string;
  content: React.ReactNode;
};

const cards: DashboardCard[] = [
  {
    title: "Calories Burned",
    content: (
      <>
        <p className="text-4xl font-bold">2,305</p>
        <div className="mt-2 h-2 w-full rounded bg-gray-700">
          <div className="h-full w-[70%] rounded bg-red-500" />
        </div>
      </>
    ),
  },
  {
    title: "Journal",
    content: (
      <>
        <p className="text-sm text-gray-400">Most recent entry:</p>
        <p className="mt-1">Went for a long walk in the park.</p>
      </>
    ),
  },
  {
    title: "Finance Overview",
    content: (
      <>
        <p className="text-4xl font-bold">$850</p>
        <p className="mt-1 text-sm text-gray-400">Week-to-date spending</p>
      </>
    ),
  },
];

export default function Dashboard() {
  return (
    <main className="p-6">
      <h1 className="mb-6 text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <Card key={index} title={card.title}>
            {card.content}
          </Card>
        ))}
      </div>
    </main>
  );
}
