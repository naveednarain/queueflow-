import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('w:top', top), ('w:bottom', bottom), ('w:left', left), ('w:right', right)]:
        node = OxmlElement(m)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def add_callout(doc, text_prefix, text_body, bg_color="F1F5F9", border_color="0284C7"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_color)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="{border_color}"/>'
        f'<w:top w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'<w:bottom w:val="none"/>'
        f'</w:tcBorders>'
    )
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run_pre = p.add_run(text_prefix + " ")
    run_pre.bold = True
    run_pre.font.color.rgb = RGBColor(14, 116, 144)
    run_pre.font.size = Pt(10)
    run_body = p.add_run(text_body)
    run_body.font.size = Pt(10)
    run_body.font.color.rgb = RGBColor(30, 41, 59)
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def format_table(table, col_widths, headers, data, header_bg="1E293B"):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Header row
    hdr_row = table.rows[0]
    for idx, text in enumerate(headers):
        cell = hdr_row.cells[idx]
        cell.width = Inches(col_widths[idx])
        set_cell_background(cell, header_bg)
        set_cell_margins(cell, top=120, bottom=120, left=140, right=140)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(10)
        run.font.color.rgb = RGBColor(255, 255, 255)
    
    # Data rows
    for row_idx, row_data in enumerate(data):
        row = table.rows[row_idx + 1]
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(row_data):
            cell = row.cells[col_idx]
            cell.width = Inches(col_widths[col_idx])
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(2)
            p.paragraph_format.space_after = Pt(2)
            run = p.add_run(text)
            run.font.size = Pt(9.5)
            run.font.color.rgb = RGBColor(51, 65, 85)

def create_project_structure_doc():
    doc = Document()
    
    # Set standard 0.8 inch margins
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
    
    # Title
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_title = title_p.add_run("QueueFlow — Project Structure & Architecture Guide")
    run_title.bold = True
    run_title.font.name = "Segoe UI"
    run_title.font.size = Pt(22)
    run_title.font.color.rgb = RGBColor(15, 23, 42) # Slate 900
    
    # Subtitle
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(14)
    run_sub = sub_p.add_run("Comprehensive Technical Structure & Judge Reference Document | Built by LahootiX")
    run_sub.font.name = "Segoe UI"
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = RGBColor(71, 85, 105)
    
    add_callout(
        doc,
        "System Summary for Judges:",
        "QueueFlow is a full-stack digital queue and appointment booking platform built with Next.js 15 App Router, Supabase PostgreSQL with transactional RPCs & Realtime WebSockets, and Google Gemini 1.5 Flash AI. All database operations use transactional advisory locks and Row-Level Security."
    )
    
    # Section 1
    h1 = doc.add_heading("1. High-Level Architecture & Connectivity", level=1)
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(6)
    
    p = doc.add_paragraph(
        "QueueFlow connects five core architectural layers into an automated, event-driven ecosystem:"
    )
    p.paragraph_format.space_after = Pt(4)
    
    conn_points = [
        ("Frontend Client Layer (Next.js 15 App Router):", " Role-specific web interfaces for Customers (/book, /token, /my), Staff (/staff), Managers (/manager), Admins (/admin), and a public TV display kiosk (/display)."),
        ("Backend & Server Action Layer (Node.js):", " Server Actions (lib/actions/*) execute server-side business workflows with strict Zod validation and session authorization before reaching the database."),
        ("Database & Stored Procedures (Supabase PostgreSQL):", " Single source of truth (supabase/functions.sql). Transactional RPCs handle concurrency, ticket generation, slot validation, and status transitions with zero race conditions."),
        ("Realtime Synchronization Engine (WebSockets):", " Supabase Realtime broadcast channels notify active customer views (/my) and display boards (/display) the moment a staff member calls a token, without manual page refreshing."),
        ("AI & Intelligence Services (Gemini + Algorithms):", " Google Gemini 1.5 Flash generates actionable managerial operations insights, powers the interactive live assistant widget, and algorithmic heuristics predict wait times and no-show risks.")
    ]
    for bullet_title, bullet_desc in conn_points:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        r1 = bp.add_run(bullet_title)
        r1.bold = True
        r1.font.color.rgb = RGBColor(30, 41, 59)
        r2 = bp.add_run(bullet_desc)
        r2.font.color.rgb = RGBColor(71, 85, 105)
        
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

    # Section 2
    h2 = doc.add_heading("2. Important Folders & Their Purpose", level=1)
    h2.paragraph_format.space_before = Pt(12)
    h2.paragraph_format.space_after = Pt(6)
    
    folder_headers = ["Folder / Directory", "Filesystem Path", "Architectural Purpose"]
    folder_data = [
        ["app/", "app/", "Next.js 15 App Router root containing all role pages, layouts, and API routes."],
        ["app/book/", "app/book/", "Interactive multi-step appointment booking wizard with real-time slot selection."],
        ["app/token/", "app/token/", "Walk-in ticket generation interface with live estimated wait time display."],
        ["app/my/", "app/my/", "Customer personal portal displaying active live token card and visit history."],
        ["app/staff/", "app/staff/", "Staff counter terminal supporting Call Next, Start, Complete, Skip, and Recall."],
        ["app/manager/", "app/manager/", "Operations dashboard with Recharts analytics, KPI cards, and AI staffing tips."],
        ["app/admin/", "app/admin/", "System governance panel managing rules, services, departments, and user roles."],
        ["app/display/", "app/display/", "Full-screen live TV queue board for waiting area kiosks."],
        ["app/api/ai/", "app/api/ai/", "Server-side Gemini AI endpoints for managerial insights and live assistant."],
        ["components/", "components/", "Reusable UI widgets: AI Assistant Widget, AI Insights Card, Notification Bell."],
        ["lib/actions/", "lib/actions/", "Server Actions with Zod schemas for appointments, tokens, staff, and admin."],
        ["lib/ai/", "lib/ai/", "Heuristic AI modules for wait-time prediction, no-show scoring, and staffing."],
        ["lib/supabase/", "lib/supabase/", "SSR-compatible Supabase database client initializers."],
        ["supabase/", "supabase/", "SQL migrations: schema.sql (RLS & tables), functions.sql (RPCs), seed.sql."]
    ]
    t_folders = doc.add_table(rows=len(folder_data) + 1, cols=3)
    format_table(t_folders, [1.4, 1.4, 4.0], folder_headers, folder_data)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 3
    h3 = doc.add_heading("3. Important Files & Key Implementation Responsibilities", level=1)
    h3.paragraph_format.space_before = Pt(12)
    h3.paragraph_format.space_after = Pt(6)
    
    file_headers = ["File Name", "Relative Location", "Key Implementation Responsibility"]
    file_data = [
        ["functions.sql", "supabase/functions.sql", "Core database logic: transactional RPCs with advisory locks for booking, queueing, and status transitions."],
        ["schema.sql", "supabase/schema.sql", "Database schema definition: 9 tables, relational foreign keys, and complete RLS security policies."],
        ["seed.sql", "supabase/seed.sql", "Seed dataset: 3 departments, 7 services, 5 counters, 6 demo accounts, and 14-day realistic queue history."],
        ["proxy.ts", "proxy.ts", "Next.js Edge middleware enforcing session validation and route-level role-based access control."],
        ["appointments.ts", "lib/actions/appointments.ts", "Server actions executing appointment booking, cancellation, rescheduling, and check-in."],
        ["tokens.ts", "lib/actions/tokens.ts", "Server actions generating walk-in tokens and checking queue limits."],
        ["staff.ts", "lib/actions/staff.ts", "Server actions for staff counter control (Call Next, Start, Complete, Skip, Status)."],
        ["admin.ts", "lib/actions/admin.ts", "Server actions for administrative configuration (rules, user roles, working hours)."],
        ["waitTime.ts", "lib/ai/waitTime.ts", "Wait time prediction model factoring queue depth, service averages, and 11am-1pm peak surge."],
        ["noShow.ts", "lib/ai/noShow.ts", "No-show risk scoring algorithm (0.0 to 1.0) assessing lead time, slot time, and customer history."],
        ["staffRecommendation.ts", "lib/ai/staffRecommendation.ts", "Dynamic staffing formula: ceil(demand * avg_service_duration / 60) for counter capacity."],
        ["insights/route.ts", "app/api/ai/insights/route.ts", "Gemini 1.5 Flash operations analyst endpoint with Zod validation and 5-min caching."],
        ["assistant/route.ts", "app/api/ai/assistant/route.ts", "Gemini 1.5 Flash conversational assistant backend for user help and system navigation."],
        ["ai-assistant-widget.tsx", "components/ai-assistant-widget.tsx", "Floating chat support widget accessible globally on all pages with pre-built prompt chips."]
    ]
    t_files = doc.add_table(rows=len(file_data) + 1, cols=3)
    format_table(t_files, [1.6, 1.8, 3.4], file_headers, file_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 4
    h4 = doc.add_heading("4. Implementation Blueprint: Appointment & Queue Logic", level=1)
    h4.paragraph_format.space_before = Pt(12)
    h4.paragraph_format.space_after = Pt(6)

    p_app = doc.add_paragraph()
    p_app.add_run("Where Appointment Logic Lives:").bold = True
    doc.add_paragraph(
        "1. Slot Discovery: supabase/functions.sql -> get_available_slots() dynamically generates slot grids based on department working hours and designated break times, checking booked capacity in real time.\n"
        "2. Booking Concurrency: supabase/functions.sql -> book_appointment() uses PostgreSQL advisory locks to guarantee zero overbooking under high concurrent load, enforcing the daily booking ceiling.\n"
        "3. Check-In & Priority Tokens: supabase/functions.sql -> check_in() verifies that the customer is within the allowed arrival window (-30 min to +15 min) and generates an expedited Priority Token (prefix 'P-') placed at the head of the queue.\n"
        "4. Missed Appointment Cleanup: supabase/functions.sql -> mark_missed_appointments() automatically transitions unfulfilled past slots to 'missed' status and releases counter capacity."
    )

    p_q = doc.add_paragraph()
    p_q.add_run("Where Queue & Token Logic Lives:").bold = True
    doc.add_paragraph(
        "1. Walk-in Token Creation: supabase/functions.sql -> create_token() verifies daily token limits, prevents duplicate active tokens for the same user, and assigns sequential departmental tokens (e.g., A-001).\n"
        "2. Dynamic Queue Recalculation: supabase/functions.sql -> recalc_queue() recalculates position order and wait times whenever a customer checks in or a counter changes status.\n"
        "3. Counter Service Flow: supabase/functions.sql -> call_next_token(), start_service(), complete_service(), skip_token() execute atomic state transitions and notify connected clients over Supabase Realtime."
    )

    # Section 5
    h5 = doc.add_heading("5. Implementation Blueprint: AI & Intelligent Features", level=1)
    h5.paragraph_format.space_before = Pt(12)
    h5.paragraph_format.space_after = Pt(6)

    ai_headers = ["Intelligent Feature", "Code Location", "Mechanism & Algorithmic Design"]
    ai_data = [
        ["Predictive Wait Times", "lib/ai/waitTime.ts\napp/token/page.tsx", "Calculates ETA using queue depth, active counters, and historical duration averages, applying a 1.25x multiplier during peak hours (11:00 AM - 1:00 PM)."],
        ["No-Show Risk Scoring", "lib/ai/noShow.ts\napp/staff/page.tsx", "Evaluates lead time, appointment hour, and past attendance to assign a 0.0-1.0 risk score, displayed as colored badges on the staff counter list."],
        ["Smart Staff Recommendation", "lib/ai/staffRecommendation.ts\napp/manager/page.tsx", "Uses operations research formula ceil(demand * duration / 60) to recommend counter staffing levels to managers."],
        ["Manager Operations Insights", "app/api/ai/insights/route.ts\ncomponents/ai-insights-card.tsx", "Google Gemini 1.5 Flash analyzes aggregated non-PII metrics to generate 3-5 concise, actionable operational recommendations."],
        ["In-App AI Assistant", "app/api/ai/assistant/route.ts\ncomponents/ai-assistant-widget.tsx", "Conversational AI widget answering customer queries regarding appointment booking, queue status, and system navigation."]
    ]
    t_ai = doc.add_table(rows=len(ai_data) + 1, cols=3)
    format_table(t_ai, [1.7, 1.8, 3.3], ai_headers, ai_data)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 6
    h6 = doc.add_heading("6. Security & Governance Architecture", level=1)
    h6.paragraph_format.space_before = Pt(12)
    h6.paragraph_format.space_after = Pt(6)

    sec_points = [
        ("Row-Level Security (RLS):", " Active on all 9 tables. Customers only view their personal records; staff and managers view department queues; admins view all."),
        ("Role Escalation Protection:", " PostgreSQL trigger prevent_self_role_escalation prevents non-admin users from altering their own role in the database."),
        ("Stored Procedure Hardening:", " All security definer RPC functions explicitly specify SET search_path = public to neutralize search-path escalation attacks."),
        ("HTTP Security Headers:", " next.config.ts enforces X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, and Permissions-Policy."),
        ("Credential Protection:", " Demo credentials and API keys are strictly kept server-side in .env.local; zero secrets are exposed in the client or committed to Git.")
    ]
    for b_title, b_desc in sec_points:
        bp = doc.add_paragraph(style='List Bullet')
        bp.paragraph_format.space_before = Pt(2)
        bp.paragraph_format.space_after = Pt(2)
        r1 = bp.add_run(b_title)
        r1.bold = True
        r1.font.color.rgb = RGBColor(30, 41, 59)
        r2 = bp.add_run(b_desc)
        r2.font.color.rgb = RGBColor(71, 85, 105)

    doc.add_paragraph().paragraph_format.space_after = Pt(6)

    # Section 7
    h7 = doc.add_heading("7. Demo Accounts & Verification Guide for Judges", level=1)
    h7.paragraph_format.space_before = Pt(12)
    h7.paragraph_format.space_after = Pt(6)

    acc_headers = ["Role", "Login Email", "Password", "Primary Routes", "Key Demo Action"]
    acc_data = [
        ["Customer", "customer@demo.com", "Demo@12345", "/book, /token, /my", "Book appointment slot; generate walk-in token; track real-time position."],
        ["Customer 2", "customer2@demo.com", "Demo@12345", "/book, /token, /my", "Test concurrent queue progression and multi-user ordering."],
        ["Staff", "staff@demo.com", "Demo@12345", "/staff", "Select counter; call next token; view no-show risk badge; complete service."],
        ["Manager", "manager@demo.com", "Demo@12345", "/manager", "Review Recharts metrics, Gemini operational insights, and staff recommendations."],
        ["Admin", "admin@demo.com", "Demo@12345", "/admin", "Adjust queue limits, manage departments/services, and assign user roles."],
        ["Public Kiosk", "(Public access)", "N/A", "/display", "View full-screen live waiting room TV display with real-time token calling."]
    ]
    t_acc = doc.add_table(rows=len(acc_data) + 1, cols=5)
    format_table(t_acc, [1.0, 1.6, 1.0, 1.4, 1.8], acc_headers, acc_data)

    output_path = os.path.abspath("PROJECT_STRUCTURE.docx")
    doc.save(output_path)
    print(f"Successfully generated Word document: {output_path}")

if __name__ == "__main__":
    create_project_structure_doc()
