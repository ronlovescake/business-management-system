import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';
import { z } from 'zod';
import {
  HANDBOOK_MODULES,
  type HandbookModuleId,
  type HandbookProcedure,
} from './handbook';

const metadataSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9-]+$/),
  modules: z
    .array(
      z
        .string()
        .refine((value) =>
          HANDBOOK_MODULES.some((module) => module.id === value)
        )
    )
    .min(1),
  kind: z.enum(['workflow', 'issue', 'reference', 'accounting']),
});

function headingAnchor(heading: string) {
  return heading
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s/g, '-');
}

export function parseHandbook(markdown: string): HandbookProcedure[] {
  const sections: {
    metadata: z.infer<typeof metadataSchema>;
    title: string;
    depth: number;
    markdown: string;
  }[] = [];
  const anchors = new Map<string, string>();
  let pending: z.infer<typeof metadataSchema> | undefined;
  let current: (typeof sections)[number] | undefined;

  for (const token of marked.lexer(markdown)) {
    if (token.type === 'html' && token.raw.includes('<!-- handbook:')) {
      if (pending) {
        throw new Error('Handbook metadata must precede a heading');
      }
      const match = token.raw.match(/^<!-- handbook:\s*(\{[^]*?\})\s*-->\s*$/);
      if (!match) {
        throw new Error('Invalid handbook metadata');
      }
      pending = metadataSchema.parse(JSON.parse(match[1]));
      current = undefined;
      continue;
    }

    if (pending && token.type !== 'space' && token.type !== 'heading') {
      throw new Error('Handbook metadata must precede a heading');
    }

    if (token.type === 'heading') {
      if (pending) {
        if (sections.some((section) => section.metadata.id === pending?.id)) {
          throw new Error(`Duplicate handbook ID: ${pending.id}`);
        }
        current = {
          metadata: pending,
          title: token.text.replace(/\*\*/g, ''),
          depth: token.depth,
          markdown: '',
        };
        sections.push(current);
        pending = undefined;
      } else if (current && token.depth <= current.depth) {
        current = undefined;
      }

      if (current) {
        anchors.set(headingAnchor(token.text), current.metadata.id);
      }
      if (current && token.depth === current.depth) {
        continue;
      }
    }

    if (current) {
      current.markdown += token.raw;
    }
  }

  if (pending) {
    throw new Error('Handbook metadata must precede a heading');
  }
  if (!sections.length) {
    throw new Error('No employee handbook procedures found');
  }

  const renderer = new marked.Renderer();
  renderer.link = (href, _title, text) => {
    const fragment = href?.startsWith('#') ? href.slice(1) : undefined;
    const target = fragment
      ? (anchors.get(fragment) ??
        sections.find((section) => section.metadata.id === fragment)?.metadata
          .id)
      : undefined;
    if (fragment && !target) {
      throw new Error(`Unknown handbook link: ${href}`);
    }
    return target ? `<a href="#${target}">${text}</a>` : text;
  };

  return sections.map((section) => {
    if (!section.markdown.trim()) {
      throw new Error(`Empty handbook procedure: ${section.metadata.id}`);
    }
    const labels = HANDBOOK_MODULES.filter((module) =>
      section.metadata.modules.includes(module.id)
    ).map((module) => `${module.group} ${module.label}`);

    return {
      id: section.metadata.id,
      title: section.title,
      modules: section.metadata.modules as HandbookModuleId[],
      kind: section.metadata.kind,
      html: DOMPurify.sanitize(
        marked.parse(section.markdown, {
          renderer,
          mangle: false,
          headerIds: false,
        }),
        {
          ALLOWED_TAGS: [
            'p',
            'br',
            'strong',
            'em',
            'code',
            'pre',
            'blockquote',
            'ul',
            'ol',
            'li',
            'a',
            'h3',
            'h4',
            'h5',
            'h6',
            'table',
            'thead',
            'tbody',
            'tr',
            'th',
            'td',
            'hr',
          ],
          ALLOWED_ATTR: ['href', 'start'],
          ALLOW_DATA_ATTR: false,
          ALLOWED_URI_REGEXP: /^#[A-Z][A-Z0-9-]+$/,
        }
      ),
      searchText: [
        section.metadata.id,
        section.title,
        ...labels,
        section.markdown,
      ]
        .join(' ')
        .toLocaleLowerCase(),
    };
  });
}
