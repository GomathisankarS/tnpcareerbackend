import { Router } from 'express';
import { query } from '../../db/pool.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/response.js';
export const categoryRoutes = Router();
categoryRoutes.get(
  '/',
  asyncHandler(async (req, res) =>
    sendSuccess(
      res,
      await query(
        "SELECT c.id,c.name,c.slug,COUNT(j.id) AS jobCount FROM job_categories c LEFT JOIN jobs j ON j.category_id=c.id AND j.status='published' AND j.deleted_at IS NULL WHERE c.is_active=1 GROUP BY c.id,c.name,c.slug ORDER BY c.name"
      )
    )
  )
);
