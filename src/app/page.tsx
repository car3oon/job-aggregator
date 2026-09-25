export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 bg-background text-foreground">
      <h1 className="text-4xl font-bold tracking-tight mb-4 text-primary">Job Aggregator</h1>
      <p className="text-xl text-muted-foreground text-center max-w-lg">
        Welcome to your personal job board. 
        <br /><br />
        You are successfully authenticated. We will build the layout and sidebar with categories here next.
      </p>
    </div>
  );
}
