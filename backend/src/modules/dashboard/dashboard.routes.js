import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { query } from '../../db/pool.js';
import { asyncHandler } from '../../shared/utils/asyncHandler.js';
import { sendSuccess } from '../../shared/utils/response.js';
export const dashboardRoutes = Router();
dashboardRoutes.use(authenticate, authorize('admin'));
dashboardRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const [jobs, users, applications, recent] = await Promise.all([
      query(
        "SELECT COUNT(*) AS totalJobs,COALESCE(SUM(status='published'),0) AS publishedJobs,COALESCE(SUM(status='draft'),0) AS draftJobs,COALESCE(SUM(status='closed'),0) AS closedJobs FROM jobs WHERE deleted_at IS NULL"
      ),
      query("SELECT COUNT(*) AS candidates FROM users WHERE role='candidate' AND is_active=1"),
      query('SELECT COUNT(*) AS applications FROM job_applications'),
      query(
        'SELECT j.id,j.title,j.company_name AS companyName,j.status,COUNT(a.id) AS applicationCount FROM jobs j LEFT JOIN job_applications a ON a.job_id=j.id WHERE j.deleted_at IS NULL GROUP BY j.id,j.title,j.company_name,j.status,j.created_at ORDER BY j.created_at DESC,j.id DESC LIMIT 5'
      )
    ]);
    return sendSuccess(res, {
      ...Object.fromEntries(
        Object.entries({ ...jobs[0], ...users[0], ...applications[0] }).map(([k, v]) => [
          k,
          Number(v)
        ])
      ),
      recentJobs: recent
    });
  })
);
