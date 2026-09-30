"""Render the ten English sample resumes as individual one-page PDFs."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


OUT = Path(__file__).resolve().parent
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
pdfmetrics.registerFont(TTFont("Resume", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("ResumeBold", str(FONT_DIR / "Arial Bold.ttf")))

INK = colors.HexColor("#1D2939")
MUTED = colors.HexColor("#536477")
ACCENT = colors.HexColor("#245A78")
RULE = colors.HexColor("#CBD5DF")
PAGE_W, PAGE_H = A4
LEFT = 54
RIGHT = 54
CONTENT_W = PAGE_W - LEFT - RIGHT

RESUMES = [
    {
        "score": 10, "name": "Doyun Kim", "file": "01_Doyun_Kim.pdf",
        "headline": "Logistics Operations Coordinator",
        "email": "doyun.kim@example.com", "location": "Seoul, South Korea",
        "summary": "Operations professional with three years of experience coordinating shipment schedules, resolving exceptions, and documenting frontline processes. Interested in bringing a practical understanding of operational workflows to software delivery.",
        "experience": [
            ("Operations Coordinator", "Saegil Logistics", "2023 – Present", [
                "Coordinate roughly 120 daily outbound orders across four carrier partners and resolve schedule changes with warehouse teams.",
                "Created spreadsheet templates and step-by-step guides that standardized order checks for new team members.",
                "Compiled weekly delivery-delay reports and presented recurring issues to operations managers.",
            ]),
        ],
        "projects": [
            "Built a personal Python script to consolidate shipment CSV files and flag missing tracking numbers.",
        ],
        "skills": "Operations coordination · Stakeholder communication · Spreadsheets · Basic Python",
    },
    {
        "score": 20, "name": "Seoyun Park", "file": "02_Seoyun_Park.pdf",
        "headline": "Data Analyst",
        "email": "seoyun.park@example.com", "location": "Seoul, South Korea",
        "summary": "Data analyst with experience translating sales and operations questions into dashboards and repeatable reports. Comfortable with SQL and Python data workflows and early-stage product experimentation.",
        "experience": [
            ("Data Analyst", "Leaf Commerce", "2024 – Present", [
                "Built six SQL dashboards and a weekly revenue report used by sales and operations teams.",
                "Automated CSV cleanup in Python and pandas, saving approximately four hours of reporting work each week.",
                "Documented shared metric definitions across two departments to reduce discrepancies in reporting.",
            ]),
        ],
        "projects": [
            "Contributed data preparation and prompt testing to an internal FAQ chatbot hackathon prototype.",
        ],
        "skills": "SQL · Python · pandas · BI dashboards · Requirements gathering · Data quality",
    },
    {
        "score": 30, "name": "Hyunwoo Lee", "file": "03_Hyunwoo_Lee.pdf",
        "headline": "Backend Software Engineer",
        "email": "hyunwoo.lee@example.com", "location": "Seoul, South Korea",
        "summary": "Backend engineer building production APIs and improving reliability for internal commerce systems. Experienced in Python services, incident response, code review, and incremental releases.",
        "experience": [
            ("Backend Engineer", "Morae Market", "2023 – Present", [
                "Developed eight settlement APIs in Python and FastAPI and participated in peer reviews and production releases.",
                "Added retry logic and alerts for failed queue jobs, reducing manual reprocessing from 90 to 25 cases per month.",
                "Converted requests from the operations team into API changes shipped on a two-week cadence.",
            ]),
        ],
        "projects": [
            "Prototyped semantic search over personal notes using embeddings and a lightweight Python API.",
        ],
        "skills": "Python · FastAPI · PostgreSQL · Docker · CI/CD · Incident response · JavaScript fundamentals",
    },
    {
        "score": 40, "name": "Minji Choi", "file": "04_Minji_Choi.pdf",
        "headline": "Senior Frontend Engineer",
        "email": "minji.choi@example.com", "location": "Seoul, South Korea",
        "summary": "Frontend engineer with six years of experience shipping B2B management products. Combines customer interviews, accessible interface design, and usage analysis to improve adoption.",
        "experience": [
            ("Senior Frontend Engineer", "Nextboard", "2021 – Present", [
                "Built a React and TypeScript admin console and interviewed 12 customer administrators to identify usability issues.",
                "Reduced a core workflow from nine steps to five; weekly feature usage increased from 42% to 58%.",
                "Documented reusable design-system components adopted by three product teams.",
            ]),
            ("Frontend Engineer", "PageLab", "2020 – 2021", [
                "Delivered customer dashboards and improved accessibility and load performance across key screens.",
            ]),
        ],
        "projects": [],
        "skills": "React · TypeScript · JavaScript · Frontend testing · Accessibility · Product analytics",
    },
    {
        "score": 50, "name": "Yujin Jung", "file": "05_Yujin_Jung.pdf",
        "headline": "Machine Learning Engineer",
        "email": "yujin.jung@example.com", "location": "Seoul, South Korea",
        "summary": "ML engineer focused on search and summarization workflows. Builds data pipelines, model-serving APIs, and evaluation datasets that turn model quality into measurable engineering decisions.",
        "experience": [
            ("Machine Learning Engineer", "Daon Pay", "2022 – Present", [
                "Built an embedding pipeline for customer-support document search and curated a 300-case retrieval evaluation set.",
                "Improved an internal support-summary pilot's evaluation pass rate from 71% to 84% by addressing factual errors and retrieval scope.",
                "Developed Python model-serving APIs and batch jobs for a 40-person internal pilot.",
            ]),
            ("Data Engineer", "Cent Data", "2021 – 2022", [
                "Maintained log-ingestion jobs and data-quality checks for analytics and ML use cases.",
            ]),
        ],
        "projects": [],
        "skills": "Python · FastAPI · SQL · Vector search · Model evaluation · Data pipelines · JavaScript fundamentals",
    },
    {
        "score": 60, "name": "Jihoon Han", "file": "06_Jihoon_Han.pdf",
        "headline": "Senior Full-Stack Engineer",
        "email": "jihoon.han@example.com", "location": "Seoul, South Korea",
        "summary": "Full-stack engineer with seven years of experience designing, building, and operating B2B SaaS workflows. Works directly with customer engineering teams to scope integrations and sequence reliable releases.",
        "experience": [
            ("Senior Full-Stack Engineer", "Bridgeflow", "2021 – Present", [
                "Designed and shipped a React, TypeScript, and FastAPI approval workflow to 18 enterprise customers.",
                "Aligned API and access-control requirements with customer engineers and migrated customers in stages without service interruption.",
                "Used product telemetry to reduce median approval completion time from 2.4 to 1.6 days.",
                "Integrated a generative-AI drafting API into the product's document workflow.",
            ]),
            ("Software Engineer", "Lineworks Lab", "2019 – 2021", [
                "Developed web interfaces and APIs, reviewed code, and supported production incident response.",
            ]),
        ],
        "projects": [],
        "skills": "Python · FastAPI · React · TypeScript · PostgreSQL · AWS · CI/CD · Observability",
    },
    {
        "score": 70, "name": "Serin Oh", "file": "07_Serin_Oh.pdf",
        "headline": "Customer-Facing AI Engineer",
        "email": "serin.oh@example.com", "location": "Seoul, South Korea",
        "summary": "AI engineer with six years of customer-facing delivery experience. Builds retrieval-based LLM applications with customer teams, translating security and workflow constraints into working software.",
        "experience": [
            ("Solutions Engineer", "Pine AI", "2022 – Present", [
                "Scoped and built document-search LLM pilots for three finance and retail customers, including data-access reviews with customer security teams.",
                "Wrote the FastAPI backend and React review interface for a support tool deployed to 120 agents at one customer.",
                "Collected incorrect-citation examples and adjusted retrieval chunking and prompts to improve response quality.",
                "Led two weeks of on-site training during launch and handed support procedures to the customer's operations team.",
            ]),
            ("Software Engineer", "Cloudwave", "2020 – 2022", [
                "Delivered customer API integrations and deployment automation for cloud applications.",
            ]),
        ],
        "projects": [],
        "skills": "Python · FastAPI · JavaScript · React · RAG · API integration · Docker · Cloud deployment",
    },
    {
        "score": 80, "name": "Jaemin Song", "file": "08_Jaemin_Song.pdf",
        "headline": "Forward Deployed Engineer",
        "email": "jaemin.song@example.com", "location": "Seoul, South Korea",
        "summary": "Deployment engineer with eight years of experience delivering enterprise software and LLM workflows. Owns discovery through production handoff, coordinates security reviews, and measures workflow adoption.",
        "experience": [
            ("Forward Deployed Engineer", "Ascent Cloud", "2022 – Present", [
                "Led discovery, architecture, implementation, and operational handoff for four manufacturing and insurance customers.",
                "Built Python services, TypeScript and React review tools, access controls, and audit logs for production document workflows.",
                "Reached 310 weekly active users across two customers and reduced average review time from 38 to 24 minutes per case.",
                "Established a 500-case citation-coverage evaluation set and weekly regression runs.",
                "Created a reusable permissions module and deployment checklist applied to two later customer launches.",
            ]),
            ("Full-Stack Engineer", "Oncore Tech", "2018 – 2022", [
                "Built B2B data-product APIs, web interfaces, and production monitoring.",
            ]),
        ],
        "projects": [],
        "skills": "Python · FastAPI · TypeScript · React · PostgreSQL · RAG · LLM evaluation · Cloud operations",
    },
    {
        "score": 90, "name": "Suhyun Bae", "file": "09_Suhyun_Bae.pdf",
        "headline": "Lead AI Deployment Engineer",
        "email": "suhyun.bae@example.com", "location": "Seoul, South Korea",
        "summary": "Customer-facing engineer with nine years of experience leading complex AI deployments in regulated environments. Aligns customer engineering, security, and product teams while owning hands-on delivery and adoption metrics.",
        "experience": [
            ("Lead Deployment Engineer", "Prism AI", "2021 – Present", [
                "Led five LLM deployments for banking and telecom customers, running up to three projects concurrently and adjusting scope to protect launch dates.",
                "Implemented Python orchestration and evaluation APIs plus React review tools with customer-specific access and audit requirements.",
                "Reached 480 weekly active users in the first 90 days of a support-search deployment; achieved 63% answer acceptance and 29% lower average handling time.",
                "Maintained a 900-case evaluation set covering correctness, citations, and refusal behavior; findings informed product prioritization for citation display.",
                "Introduced a read-only pilot when a security review delayed write access, preserving the agreed release window.",
            ]),
            ("Full-Stack Engineer", "Ssiat Software", "2017 – 2021", [
                "Built customer-facing applications and owned production incident and performance improvements.",
            ]),
        ],
        "projects": ["Authored a deployment playbook that cut environment preparation from three weeks to two."],
        "skills": "Python · TypeScript · React · PostgreSQL · Kubernetes · LLM evaluation · Observability",
    },
    {
        "score": 100, "name": "Harin Ryu", "file": "10_Harin_Ryu.pdf",
        "headline": "Principal Forward Deployed Engineer",
        "email": "harin.ryu@example.com", "location": "Seoul, South Korea",
        "summary": "Forward deployed engineer with ten years of experience taking enterprise AI products from discovery to sustained production adoption. Combines hands-on full-stack development, eval-driven iteration, cross-functional leadership, and reusable deployment systems.",
        "experience": [
            ("Principal Forward Deployed Engineer", "Nova Systems", "2020 – Present", [
                "Owned eight LLM deployments across manufacturing, finance, and public-sector customers; managed scope, sequencing, and delivery risk for three concurrent projects.",
                "Mapped customer workflows with engineering teams and built Python, TypeScript, and React APIs, review interfaces, and evaluation services with human approval steps.",
                "Launched four production deployments reaching 1,700 weekly active users; reduced average contract-review time from 52 to 31 minutes in one workflow.",
                "Built a 2,400-case evaluation suite for correctness, citations, refusal, and latency with weekly regression runs and release rollback gates.",
                "Shared reproducible long-document citation failures with research and product teams; joint experiments raised citation coverage from 76% to 91% on the customer evaluation set.",
                "Resolved security and data-boundary blockers through permission isolation and staged releases; created templates and playbooks reused by six engineers.",
            ]),
            ("Senior Full-Stack Engineer", "Solar Web", "2016 – 2020", [
                "Built B2B web applications, APIs, and data pipelines; led customer integrations and operational handoffs.",
            ]),
        ],
        "projects": [],
        "skills": "Python · FastAPI · TypeScript · React · PostgreSQL · Kubernetes · LLM evaluation · Security requirements · Observability",
    },
]


def para(text, size=10.0, leading=14.5, color=INK, bold=False, indent=0):
    return Paragraph(text, ParagraphStyle(
        "item", fontName="ResumeBold" if bold else "Resume", fontSize=size,
        leading=leading, textColor=color, alignment=TA_LEFT,
        leftIndent=indent, spaceBefore=0, spaceAfter=0,
    ))


def draw_paragraph(pdf, text, y, *, size=10.0, leading=14.5, color=INK,
                   bold=False, indent=0, after=0):
    p = para(text, size=size, leading=leading, color=color, bold=bold, indent=indent)
    _, height = p.wrap(CONTENT_W, PAGE_H)
    p.drawOn(pdf, LEFT, y - height)
    return y - height - after


def section(pdf, title, y):
    y -= 15
    pdf.setStrokeColor(RULE)
    pdf.setLineWidth(0.6)
    pdf.line(LEFT, y, PAGE_W - RIGHT, y)
    y -= 17
    pdf.setFont("ResumeBold", 9)
    pdf.setFillColor(ACCENT)
    pdf.drawString(LEFT, y, title.upper())
    return y - 12


def bullet(pdf, text, y):
    pdf.setFillColor(ACCENT)
    pdf.circle(LEFT + 3, y - 5.2, 1.4, fill=1, stroke=0)
    return draw_paragraph(pdf, text, y, indent=12, after=4)


def render(resume):
    target = OUT / resume["file"]
    pdf = canvas.Canvas(str(target), pagesize=A4, pageCompression=1)
    pdf.setTitle(f"{resume['name']} — Resume")
    pdf.setAuthor(resume["name"])
    pdf.setFillColor(colors.white)
    pdf.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    y = PAGE_H - 53

    pdf.setFillColor(INK)
    pdf.setFont("ResumeBold", 25)
    pdf.drawString(LEFT, y, resume["name"])
    y -= 22
    pdf.setFillColor(ACCENT)
    pdf.setFont("ResumeBold", 11)
    pdf.drawString(LEFT, y, resume["headline"])
    y -= 18
    pdf.setFillColor(MUTED)
    pdf.setFont("Resume", 8.5)
    pdf.drawString(LEFT, y, f"{resume['location']}  |  {resume['email']}")
    y -= 3

    y = section(pdf, "Profile", y)
    y = draw_paragraph(pdf, resume["summary"], y)

    y = section(pdf, "Experience", y)
    for title, company, dates, bullets in resume["experience"]:
        y = draw_paragraph(pdf, f"{title}  |  {company}", y, size=10.2,
                           leading=14.5, bold=True, after=2)
        y = draw_paragraph(pdf, dates, y, size=8.2, leading=11,
                           color=MUTED, after=6)
        for line in bullets:
            y = bullet(pdf, line, y)
        y -= 4

    if resume["projects"]:
        y = section(pdf, "Selected Project" if len(resume["projects"]) == 1 else "Selected Projects", y)
        for line in resume["projects"]:
            y = bullet(pdf, line, y)

    y = section(pdf, "Skills", y)
    y = draw_paragraph(pdf, resume["skills"], y, size=9.4, leading=13.5)

    if y < 45:
        raise RuntimeError(f"Content overflows one page: {resume['name']} (bottom {y:.1f})")
    pdf.showPage()
    pdf.save()
    return target, y


if __name__ == "__main__":
    for resume in RESUMES:
        path, bottom = render(resume)
        print(f"{path.name}: {path.stat().st_size:,} bytes, bottom={bottom:.1f} pt")
