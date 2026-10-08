import { ButtonLink, EmptyState } from '@/components/ui';

export default function NotFound() {
  return (
    <EmptyState title="Page not found">
      <ButtonLink href="/" className="mt-4">
        Back to the store
      </ButtonLink>
    </EmptyState>
  );
}
