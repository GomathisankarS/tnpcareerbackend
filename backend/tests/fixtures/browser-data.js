// Used only by browser-server.js against its newly created test database.
const categories = [
  ['Engineering', 'engineering'],
  ['Data & Analytics', 'data-analytics'],
  ['Design & Creative', 'design-creative'],
  ['Product & Operations', 'product-operations']
];
const jobs = [
  [
    'Frontend Developer',
    'Northstar Labs',
    'Kochi',
    'junior',
    'hybrid',
    'full_time',
    0,
    ['React', 'JavaScript', 'CSS']
  ],
  [
    'Data Analyst',
    'Meridian Analytics',
    'Mumbai',
    'junior',
    'onsite',
    'full_time',
    1,
    ['SQL', 'Python', 'Excel']
  ],
  [
    'Product Designer',
    'Studio Fern',
    null,
    'mid',
    'remote',
    'full_time',
    2,
    ['Figma', 'Prototyping', 'Research']
  ],
  [
    'Backend Engineer',
    'Cedar Systems',
    'Bengaluru',
    'mid',
    'hybrid',
    'full_time',
    0,
    ['Node.js', 'MySQL', 'REST']
  ],
  [
    'Operations Associate',
    'Orbit Works',
    'Pune',
    'fresher',
    'onsite',
    'full_time',
    3,
    ['Communication', 'Excel', 'Planning']
  ],
  [
    'Software Engineering Intern',
    'Northstar Labs',
    null,
    'fresher',
    'remote',
    'internship',
    0,
    ['JavaScript', 'Git', 'Problem solving']
  ]
];
export async function createBrowserData(connection) {
  const [[admin]] = await connection.query("SELECT id FROM users WHERE role='admin' LIMIT 1");
  const categoryIds = [];
  for (const [name, slug] of categories) {
    const [result] = await connection.query('INSERT INTO job_categories(name,slug) VALUES (?,?)', [
      name,
      slug
    ]);
    categoryIds.push(result.insertId);
  }
  for (const [title, company, city, level, mode, type, category, skills] of jobs) {
    await connection.query(
      "INSERT INTO jobs(category_id,created_by,title,company_name,location_city,experience_level,work_mode,employment_type,min_experience_months,max_experience_months,salary_min_annual_inr,salary_max_annual_inr,description,skills,is_featured,status,published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'published',UTC_TIMESTAMP(6))",
      [
        categoryIds[category],
        admin.id,
        title,
        company,
        city,
        level,
        mode,
        type,
        level === 'mid' ? 24 : 0,
        level === 'mid' ? 60 : 24,
        400000,
        level === 'mid' ? 1800000 : 900000,
        `Test vacancy for ${title}. Required skills: ${skills.join(', ')}.`,
        JSON.stringify(skills)
      ]
    );
  }
}
