# CredX Smart Job Matcher

An explainable job and internship recommendation dashboard built for the CredX Hiring Hackathon.

## Stack

- **Frontend:** Next.js, TypeScript, Tailwind CSS
- **Backend:** Python, FastAPI
- **Data:** SQLite + SQLAlchemy, with seeded job listings for the MVP

## Run locally

Open two PowerShell terminals from the repository root.

### 1. Backend

```powershell
.\.venv\Scripts\Activate.ps1
$env:PYTHONPATH = "backend"
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Interactive API documentation is at `http://localhost:8000/docs`.

### 2. Frontend

```powershell
cd frontend
node .\node_modules\next\dist\bin\next dev
```

Open `http://localhost:3000`.

## Match score (100 points)

| Signal | Points | Explanation |
| --- | ---: | --- |
| Skill overlap | 60 | Proportion of job skills found in the student profile |
| GPA eligibility | 20 | Awarded when the role's GPA threshold is met |
| Location fit | 5 | Awarded for a matching preference or `Any` |
| Work mode fit | 5 | Awarded for a matching preference or `Any mode` |
| Sponsorship / work authorization | 10 | Awarded when compatibility is confirmed |

The result card always states the matched skills and each eligibility decision, so the score is transparent to students and judges.

## MVP demo flow

1. Enter a student profile with skills, GPA, preferences, and sponsorship need.
2. Attach a PDF resume (up to 5 MB) to complete the profile.
3. Click **Find my matches**.
4. Explain the ranked results and score breakdown.
5. Change the GPA or sponsorship preference to show that the eligibility result updates logically.
6. Use the role, location, work-mode, and sponsorship filters to narrow the ranked list.

## Next features, in priority order

1. Add application tracking (`saved`, `applied`, `interviewing`, `rejected`).
2. Add an admin screen to create and edit job listings.
3. Deploy frontend and API, then record the demo video.
