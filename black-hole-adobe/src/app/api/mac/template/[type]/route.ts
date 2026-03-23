/**
 * GET /api/mac/template/[type]
 *
 * Returns a YAML migration config template for the given type.
 */

import { type NextRequest } from 'next/server';
import { success, error } from '@/lib/api/response';
import { getTemplate, getTemplateList } from '@/lib/mac/templates';
import { TEMPLATE_NAMES, type TemplateName } from '@/lib/mac/schema';

type RouteParams = { params: Promise<{ type: string }> };

export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  try {
    const { type } = await params;

    // Special case: list all templates
    if (type === 'list') {
      return success(getTemplateList());
    }

    if (!TEMPLATE_NAMES.includes(type as TemplateName)) {
      return error(
        'INVALID_TEMPLATE',
        `Unknown template type "${type}". Available: ${TEMPLATE_NAMES.join(', ')}`,
        404,
      );
    }

    const template = getTemplate(type as TemplateName);

    return success({
      type,
      template,
    });
  } catch (err) {
    console.error(`[API] GET /api/mac/template error:`, err);
    return error('INTERNAL_ERROR', 'Failed to get template', 500);
  }
}
