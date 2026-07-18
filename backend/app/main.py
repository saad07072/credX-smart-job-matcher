from __future__ import annotations

from enum import Enum
from pathlib import Path
from uuid import uuid4

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Float, Integer, String, Text, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker


class WorkMode(str, Enum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"


class Base(DeclarativeBase):
    pass


class JobModel(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(120))
    company: Mapped[str] = mapped_column(String(120))
    location: Mapped[str] = mapped_column(String(80))
    work_mode: Mapped[str] = mapped_column(String(20))
    skills_csv: Mapped[str] = mapped_column(Text)
    minimum_gpa: Mapped[float] = mapped_column(Float)
    sponsorship_available: Mapped[bool] = mapped_column(Boolean)
    description: Mapped[str] = mapped_column(Text)


class StudentProfileModel(Base):
    __tablename__ = "student_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    skills_csv: Mapped[str] = mapped_column(Text)
    gpa: Mapped[float] = mapped_column(Float)
    preferred_location: Mapped[str] = mapped_column(String(80))
    preferred_work_mode: Mapped[str | None] = mapped_column(String(20), nullable=True)
    needs_sponsorship: Mapped[bool] = mapped_column(Boolean)
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)


DATABASE_PATH = Path(__file__).resolve().parent.parent / "credx.db"
UPLOADS_PATH = Path(__file__).resolve().parent.parent / "uploads"
engine = create_engine(f"sqlite:///{DATABASE_PATH.as_posix()}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class StudentProfile(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    skills: list[str] = Field(min_length=1, max_length=20)
    gpa: float = Field(ge=0, le=10)
    preferred_location: str = Field(default="Any")
    preferred_work_mode: WorkMode | None = None
    needs_sponsorship: bool = False
    resume_filename: str | None = Field(default=None, max_length=255)

    @field_validator("skills")
    @classmethod
    def normalize_skills(cls, skills: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(skill.strip().lower() for skill in skills if skill.strip()))
        if not cleaned:
            raise ValueError("Choose at least one skill")
        return cleaned


class MatchFilters(BaseModel):
    role: str | None = None
    location: str | None = None
    work_mode: WorkMode | None = None
    sponsorship_available: bool | None = None


class MatchRequest(BaseModel):
    profile: StudentProfile
    filters: MatchFilters = Field(default_factory=MatchFilters)


class Job(BaseModel):
    id: int
    title: str
    company: str
    location: str
    work_mode: WorkMode
    skills: list[str]
    minimum_gpa: float
    sponsorship_available: bool
    description: str


class MatchResult(BaseModel):
    job: Job
    score: int
    matched_skills: list[str]
    reasons: list[str]
    is_eligible: bool


SEED_JOBS = [
    {"title": "Backend Engineering Intern", "company": "CredX", "location": "Pune", "work_mode": "hybrid", "skills_csv": "python,sql,rest api,fastapi", "minimum_gpa": 6.5, "sponsorship_available": False, "description": "Build reliable APIs that power trusted career identities."},
    {"title": "Data & AI Intern", "company": "TalentIQ", "location": "Bengaluru", "work_mode": "hybrid", "skills_csv": "python,sql,machine learning,pandas", "minimum_gpa": 7.0, "sponsorship_available": True, "description": "Turn workforce data into clear, useful product insights."},
    {"title": "Frontend Developer Intern", "company": "HireStack", "location": "Remote", "work_mode": "remote", "skills_csv": "react,typescript,tailwind css,javascript", "minimum_gpa": 6.0, "sponsorship_available": True, "description": "Create thoughtful, accessible candidate experiences."},
    {"title": "Full-Stack Developer Intern", "company": "CampusConnect", "location": "Mumbai", "work_mode": "onsite", "skills_csv": "python,django,sql,javascript", "minimum_gpa": 7.5, "sponsorship_available": False, "description": "Ship end-to-end features for campus recruiting teams."},
    {"title": "Cloud Platform Intern", "company": "ScaleGrid", "location": "Hyderabad", "work_mode": "hybrid", "skills_csv": "python,rest api,cloud computing,sql", "minimum_gpa": 6.8, "sponsorship_available": True, "description": "Help build resilient cloud services for growing teams."},
    {"title": "Business Intelligence Intern", "company": "MetricWorks", "location": "Remote", "work_mode": "remote", "skills_csv": "sql,power bi,pandas,data analysis", "minimum_gpa": 6.5, "sponsorship_available": True, "description": "Turn recruiting metrics into actionable dashboards."},
]


def init_database() -> None:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        columns = {row[1] for row in db.connection().exec_driver_sql("PRAGMA table_info(student_profiles)")}
        if "resume_filename" not in columns:
            db.connection().exec_driver_sql("ALTER TABLE student_profiles ADD COLUMN resume_filename VARCHAR(255)")
            db.commit()
        if db.scalar(select(JobModel.id).limit(1)) is None:
            db.add_all(JobModel(**job) for job in SEED_JOBS)
            db.commit()


def get_db():
    with SessionLocal() as db:
        yield db


def to_job(model: JobModel) -> Job:
    return Job(id=model.id, title=model.title, company=model.company, location=model.location, work_mode=WorkMode(model.work_mode), skills=model.skills_csv.split(","), minimum_gpa=model.minimum_gpa, sponsorship_available=model.sponsorship_available, description=model.description)


def save_profile(db: Session, profile: StudentProfile) -> None:
    db.add(StudentProfileModel(name=profile.name, skills_csv=",".join(profile.skills), gpa=profile.gpa, preferred_location=profile.preferred_location, preferred_work_mode=profile.preferred_work_mode.value if profile.preferred_work_mode else None, needs_sponsorship=profile.needs_sponsorship, resume_filename=profile.resume_filename))
    db.commit()


def score_job(profile: StudentProfile, job: Job) -> MatchResult:
    profile_skills, required_skills = set(profile.skills), set(job.skills)
    matched_skills = sorted(profile_skills & required_skills)
    reasons: list[str] = []
    skill_score = round(60 * len(matched_skills) / len(required_skills))
    reasons.append(f"Matched skills: {', '.join(matched_skills)}" if matched_skills else "No required skills matched yet")
    gpa_eligible = profile.gpa >= job.minimum_gpa
    reasons.append("Meets GPA requirement" if gpa_eligible else f"Requires GPA {job.minimum_gpa:.1f} or above")
    location_fit = profile.preferred_location.lower() in {"any", job.location.lower()} or job.location.lower() == "remote"
    if location_fit:
        reasons.append("Location preference compatible")
    mode_fit = profile.preferred_work_mode is None or profile.preferred_work_mode == job.work_mode
    if mode_fit:
        reasons.append("Work-mode preference compatible")
    authorization_eligible = not profile.needs_sponsorship or job.sponsorship_available
    reasons.append("Work authorization compatible" if authorization_eligible else "This role does not offer sponsorship")
    return MatchResult(job=job, score=skill_score + (20 if gpa_eligible else 0) + (5 if location_fit else 0) + (5 if mode_fit else 0) + (10 if authorization_eligible else 0), matched_skills=matched_skills, reasons=reasons, is_eligible=gpa_eligible and authorization_eligible)


def job_matches_filters(job: Job, filters: MatchFilters) -> bool:
    return ((filters.role is None or filters.role.lower() in job.title.lower()) and (filters.location is None or filters.location.lower() == job.location.lower()) and (filters.work_mode is None or filters.work_mode == job.work_mode) and (filters.sponsorship_available is None or filters.sponsorship_available == job.sponsorship_available))


app = FastAPI(title="CredX Smart Job Matching API", version="0.2.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup() -> None:
    init_database()


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/jobs", response_model=list[Job])
def list_jobs(db: Session = Depends(get_db)) -> list[Job]:
    return [to_job(job) for job in db.scalars(select(JobModel)).all()]


@app.post("/api/resumes")
async def upload_resume(file: UploadFile = File(...)) -> dict[str, str]:
    original_name = Path(file.filename or "resume.pdf").name
    if Path(original_name).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="Please upload a PDF resume.")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Resume must be 5 MB or smaller.")
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    UPLOADS_PATH.mkdir(exist_ok=True)
    stored_name = f"{uuid4().hex}.pdf"
    (UPLOADS_PATH / stored_name).write_bytes(content)
    return {"filename": original_name, "message": "Resume uploaded successfully."}


@app.post("/api/matches", response_model=list[MatchResult])
def get_matches(request: MatchRequest, db: Session = Depends(get_db)) -> list[MatchResult]:
    save_profile(db, request.profile)
    jobs = [to_job(job) for job in db.scalars(select(JobModel)).all()]
    results = [score_job(request.profile, job) for job in jobs if job_matches_filters(job, request.filters)]
    return sorted(results, key=lambda result: (result.is_eligible, result.score), reverse=True)
