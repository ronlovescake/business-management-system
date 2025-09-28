import { Container } from '@mantine/core';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  size?: number | string;
  fluid?: boolean;
  withPadding?: boolean;
}

export function PageLayout({ children, title, size = 'xl', fluid = false, withPadding = true }: PageLayoutProps) {
  return (
    <Container size={size} fluid={fluid} p={withPadding ? 'md' : 0}>
      {title && <h1>{title}</h1>}
      {children}
    </Container>
  );
}

export default PageLayout;