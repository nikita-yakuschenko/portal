import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

export function StatCard(props: { title: string; value: string; hint: string }) {
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="gap-1 px-5">
        <CardDescription>{props.title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{props.value}</CardTitle>
      </CardHeader>
      <CardFooter className="px-5">
        <p className="text-muted-foreground text-sm">{props.hint}</p>
      </CardFooter>
    </Card>
  );
}
