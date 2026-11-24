import { Card } from '../components/Card';
import { PageHeader } from '../components/PageHeader';

export function Placeholder({ title }: { readonly title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <Card>
        <p>This screen is being built.</p>
      </Card>
    </>
  );
}
