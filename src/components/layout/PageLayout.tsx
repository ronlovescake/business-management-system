import { Container } from '@mantine/core';

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  size?: number | string;
  fluid?: boolean;
  withPadding?: boolean;
  backgroundColor?: string;
}

export function PageLayout({
  children,
  title,
  size = 'xl',
  fluid = false,
  withPadding = true,
  backgroundColor,
}: PageLayoutProps) {
  return (
    <Container
      size={size}
      fluid={fluid}
      p={withPadding ? 'md' : 0}
      style={{
        backgroundColor: backgroundColor || undefined,
        minHeight: '100vh',
      }}
    >
      {title && <h1>{title}</h1>}
      {children}
    </Container>
  );
}

export default PageLayout;
