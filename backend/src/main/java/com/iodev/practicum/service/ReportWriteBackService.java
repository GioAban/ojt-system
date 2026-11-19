package com.iodev.practicum.service;

import com.iodev.practicum.dto.ReportDtos.ApplyChange;
import com.iodev.practicum.dto.ReportDtos.ApplyPreview;
import com.iodev.practicum.dto.ReportDtos.ApplyPreviewRow;
import com.iodev.practicum.dto.ReportDtos.Signatory;
import com.iodev.practicum.dto.ReportDtos.SignatoryDefaults;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorReportAudit;
import com.iodev.practicum.model.CoordinatorSavedReport;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorReportAuditRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mga pagbabago mula sa Edit mode ng report na isinusulat sa tunay na record kapag kinumpirma.
 * Dumadaan ang bawat isa sa parehong service ng normal na form (iisang tuntunin), at tinitingnan ulit
 * ang lahat dito bago sumulat. Lahat o wala ang naisusulat.
 *
 * Ito lang ang pwedeng isulat:
 *   student: company at department (assignment), section (galing sa mga dati nang section), year,
 *            start of training, petsa ng pagtatapos (tapos na lang na OJT), placement status (For Approval o Approved lang),
 *            requirement status (Submitted -> Evaluated o Invalid lang), at pagbukas o pagsara ng evaluation
 *   department: pangalan at posisyon ng supervisor
 *   company: pangalan at address
 * Hindi kailanman: score, oras, weekly at DTR, ang Evaluated na, Completed, o pag-alis ng company.
 */
@Service
public class ReportWriteBackService {

    private static final String STUDENT = "student";
    private static final String DEPARTMENT = "department";
    private static final String COMPANY = "company";
    private static final String REQUIREMENT = "requirement";
    private static final String SIGNATORY = "signatory";
    /** Mga field ng student na binabago gaya ng Students page (StudentProfileService) */
    private static final Set<String> PROFILE_FIELDS = Set.of(
            "lastname", "firstname", "middleInitial", "studentNumber", "gender",
            "contact", "email", "birthday", "address", "parent", "guardian");

    @Autowired private StudentRepository students;
    @Autowired private DepartmentRepository departments;
    @Autowired private CompanyRepository companies;
    @Autowired private DocumentRequirementRepository requirements;
    @Autowired private CoordinatorReportAuditRepository audits;
    @Autowired private PlacementService placementService;
    @Autowired private CompanyInfoService companyInfoService;
    @Autowired private StudentStatusService studentStatusService;
    @Autowired private RequirementReviewService requirementReviewService;
    @Autowired private EvaluationAccessService evaluationAccessService;
    @Autowired private OjtCompletionService ojtCompletionService;
    @Autowired private StudentProfileService studentProfileService;
    @Autowired private RequirementTitleService requirementTitleService;
    @Autowired private SignatoryService signatoryService;
    @Autowired private ReportSourceService reportSourceService;
    @Autowired private SemesterRepository semesters;

    /** Isang pagbabagong nasuri na */
    private record Checked(ApplyChange change, ApplyPreviewRow row, PreparedChange prepared) {}

    public ApplyPreview preview(Coordinator coordinator, CoordinatorSavedReport report, List<ApplyChange> changes) {
        List<ApplyPreviewRow> rows = check(coordinator, report, changes).stream().map(Checked::row).toList();
        return new ApplyPreview(rows, rows.stream().allMatch(r -> r.problem() == null));
    }

    /** Null kung naisulat lahat; kung may problema, walang isinusulat at ibinabalik ang listahan */
    public ApplyPreview apply(Coordinator coordinator, CoordinatorSavedReport report, List<ApplyChange> changes) {
        List<Checked> checked = check(coordinator, report, changes);
        List<ApplyPreviewRow> rows = checked.stream().map(Checked::row).toList();
        if (rows.isEmpty() || rows.stream().anyMatch(r -> r.problem() != null)) return new ApplyPreview(rows, false);

        String actor = coordinator.getUser() == null ? null : coordinator.getUser().getFullname();
        for (Checked c : checked) {
            if (c.prepared() == null || c.prepared().unchanged()) continue;
            c.prepared().run();
            ApplyChange change = c.change();
            ApplyPreviewRow row = c.row();
            CoordinatorReportAudit a = new CoordinatorReportAudit();
            a.setCoordinatorId(coordinator.getId());
            a.setActorName(actor);
            a.setReportId(report.getId());
            a.setSemesterId(report.getSemesterId());
            a.setTargetType(change.target());
            a.setTargetId(change.id());
            a.setTargetLabel(row.who());
            a.setField(change.refId() == null ? change.field() : change.field() + ":" + change.refId());
            a.setOldValue(row.oldValue());
            a.setNewValue(row.newValue());
            a.setAffectedCount(row.affected());
            audits.save(a);
        }
        return null;
    }

    // ---------------------------------------------------------------------

    private List<Checked> check(Coordinator coordinator, CoordinatorSavedReport report, List<ApplyChange> changes) {
        List<Checked> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        // Ilang student ang papasok sa bawat department sa kahilingang ito
        Map<Long, Integer> incoming = new HashMap<>();
        // Bagong pangalan o posisyon ng supervisor bawat department o company (magkapares ang dalawa)
        Map<String, String> supervisorPartners = new HashMap<>();
        for (ApplyChange c : changes) {
            if (c.id() != null) supervisorPartners.put(c.target() + ":" + c.id() + ":" + c.field(), c.value());
        }

        for (ApplyChange c : changes) {
            String dedupe = c.target() + ":" + c.id() + ":" + c.field() + ":" + c.refId();
            if (!seen.add(dedupe)) {
                out.add(problem(c, "", "This record appears more than once in the list."));
                continue;
            }
            if (STUDENT.equals(c.target())) out.add(checkStudent(coordinator, report, c, incoming));
            else if (DEPARTMENT.equals(c.target())) out.add(checkDepartment(coordinator, report, c, supervisorPartners));
            else if (COMPANY.equals(c.target())) out.add(checkCompany(coordinator, report, c, supervisorPartners));
            else if (REQUIREMENT.equals(c.target())) out.add(checkRequirementTitle(coordinator, report, c));
            else if (SIGNATORY.equals(c.target())) out.add(checkSignatory(coordinator, report, c));
            else out.add(problem(c, "", "That record can't be changed from a report."));
        }
        return out;
    }

    // ---- Student --------------------------------------------------------

    private Checked checkStudent(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c,
                                 Map<Long, Integer> incoming) {
        Student s = c.id() == null ? null : students.findById(c.id()).orElse(null);
        // Hindi sinasabi kung may ganitong student na hindi sa kaniya
        if (s == null || !s.getCoordinator().getId().equals(coordinator.getId())
                || !s.getSemester().getId().equals(report.getSemesterId())
                || Boolean.TRUE.equals(s.getIsArchived())) {
            return problem(c, "", "Student not found in this report's semester.");
        }
        String who = nz(s.getLastname()) + ", " + nz(s.getFirstname());
        String value = clean(c.value());
        String field = c.field() == null ? "" : c.field();

        try {
            return switch (field) {
                case "assignment" -> checkAssignment(coordinator, s, who, c, incoming);
                case "section" -> {
                    String old = nz(s.getSubjectCode());
                    if (stale(c, old)) yield changed(c, who, "Section / Subject code", old, value, 1);
                    // Dagdag sa report (napagkasunduan): ang dati nang mga section lang
                    if (!value.isEmpty() && !sections(coordinator, report).contains(value)) {
                        throw ActionException.bad("Choose one of the existing sections.");
                    }
                    yield ok(c, who, studentProfileService.check(s, "course", value));
                }
                case "year" -> {
                    String old = nz(s.getYear());
                    if (stale(c, old)) yield changed(c, who, "Year", old, value, 1);
                    if (value.isEmpty()) throw ActionException.bad("Choose a year from 1st Year to 5th Year.");
                    yield ok(c, who, studentProfileService.check(s, "year", value));
                }
                case "startDate" -> {
                    String old = nz(s.getStartTrainingDate());
                    if (stale(c, old)) yield changed(c, who, "Start of training", old, value, 1);
                    yield ok(c, who, companyInfoService.checkStartDate(s, value));
                }
                case "completedDate" -> {
                    String old = nz(s.getCompletedDate());
                    if (stale(c, old)) yield changed(c, who, "End of training", old, value, 1);
                    yield ok(c, who, ojtCompletionService.checkCompletedDateFromReport(s, value));
                }
                case "status" -> {
                    String old = nz(s.getStatus());
                    if (stale(c, old)) yield changed(c, who, "Status", old, value, 1);
                    yield ok(c, who, studentStatusService.checkPlacement(s, value));
                }
                case "requirement" -> {
                    DocumentRequirement r = c.refId() == null ? null : requirements.findById(c.refId()).orElse(null);
                    if (r == null || !r.getCoordinator().getId().equals(coordinator.getId())
                            || !r.getSemester().getId().equals(s.getSemester().getId())) {
                        throw ActionException.bad("Requirement not found in this report's semester.");
                    }
                    String old = requirementReviewService.currentStatus(s, r);
                    if (stale(c, old)) {
                        yield changed(c, who, nz(r.getTitle()), RequirementReviewService.reportLabel(old), value, 1);
                    }
                    yield ok(c, who, requirementReviewService.checkFromReport(s, r, value));
                }
                case "midterm", "final" -> {
                    String key = field.equals("midterm") ? EvaluationAccess.MIDTERM : EvaluationAccess.FINAL;
                    String old = EvaluationAccess.isOpen(s, key) ? "open" : "closed";
                    if (stale(c, old)) yield changed(c, who, EvaluationAccess.titleOf(key), old, value, 1);
                    if (!value.equals("open") && !value.equals("closed")) {
                        throw ActionException.bad("Choose whether to open or close the evaluation.");
                    }
                    yield ok(c, who, evaluationAccessService.checkFromReport(
                            coordinator.getId(), s, report.getSemesterId(), key, value.equals("open")));
                }
                default -> {
                    if (!PROFILE_FIELDS.contains(field)) yield problem(c, who, "That field can't be changed from a report.");
                    // Parehong tuntunin at mensahe ng Students page
                    String old = StudentProfileService.currentValue(s, field);
                    if (stale(c, old)) yield changed(c, who, StudentProfileService.labelOf(field), old, value, 1);
                    yield ok(c, who, studentProfileService.check(s, field, value));
                }
            };
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, labelOf(field),
                    PROFILE_FIELDS.contains(field) ? StudentProfileService.currentValue(s, field) : "", value, 1,
                    e.getMessage()), null);
        }
    }

    private Checked checkAssignment(Coordinator coordinator, Student s, String who, ApplyChange c,
                                    Map<Long, Integer> incoming) {
        final String label = "Company and department";
        Department current = s.getDepartment();
        String old = current == null ? "" : placement(current);
        String oldId = current == null ? "" : String.valueOf(current.getId());
        if (stale(c, oldId)) return changed(c, who, label, old, "", 1);

        Long departmentId;
        try {
            departmentId = Long.valueOf(clean(c.value()));
        } catch (NumberFormatException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, label, old, "", 1, "Choose a company."), null);
        }
        // Dagdag sa report: hindi inililipat ang tapos na
        if ("Completed".equalsIgnoreCase(s.getStatus())) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, label, old, "", 1,
                    "This student has completed the OJT, so the company can't be changed."), null);
        }
        try {
            int coming = incoming.getOrDefault(departmentId, 0);
            PlacementService.Target target = placementService.check(coordinator, s, departmentId, coming);
            String next = placement(target.department());
            if (target.unchanged()) return ok(c, who, new PreparedChange(label, old, next, 1, null));
            incoming.merge(departmentId, 1, Integer::sum);
            return ok(c, who, new PreparedChange(label, old, next, 1,
                    () -> placementService.assign(coordinator, s, departmentId)));
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, label, old, "", 1, e.getMessage()), null);
        }
    }

    // ---- Department -----------------------------------------------------

    private Checked checkDepartment(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c,
                                    Map<String, String> partners) {
        Department d = c.id() == null ? null : departments.findById(c.id()).orElse(null);
        if (d == null || d.getCompany().isHiddenRequest() || !d.getCompany().getCoordinator().getId().equals(coordinator.getId())
                || !d.getCompany().getSemester().getId().equals(report.getSemesterId())) {
            return problem(c, "", "Department not found in this report's semester.");
        }
        String who = placement(d);
        String field = c.field() == null ? "" : c.field();
        if (field.equals("name")) {
            String old = nz(d.getName());
            if (old.equalsIgnoreCase("N/A")) {
                return problem(c, who, "The N/A placeholder isn't a real department, so it can't be renamed.");
            }
            if (stale(c, old)) return changed(c, who, "Department name", old, clean(c.value()), 0);
            try {
                return ok(c, who, companyInfoService.checkDepartment(d, "name", c.value(), null));
            } catch (ActionException e) {
                return new Checked(c, new ApplyPreviewRow(c.key(), who, "Department name", old, clean(c.value()), 0,
                        e.getMessage()), null);
            }
        }
        if (!field.equals("supervisorName") && !field.equals("supervisorPosition")) {
            return problem(c, who, "That field can't be changed from a report.");
        }
        String old = field.equals("supervisorName")
                ? SupervisorResolver.clean(d.getSupervisorFullname())
                : SupervisorResolver.clean(d.getSupervisorPosition());
        if (stale(c, old)) return changed(c, who, labelOf(field), old, clean(c.value()), 0);

        String partnerField = field.equals("supervisorName") ? "supervisorPosition" : "supervisorName";
        String partner = partners.get(DEPARTMENT + ":" + d.getId() + ":" + partnerField);
        try {
            return ok(c, who, companyInfoService.checkDepartment(d, field, c.value(), partner));
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, labelOf(field), old, clean(c.value()), 0,
                    e.getMessage()), null);
        }
    }

    // ---- Company --------------------------------------------------------

    private Checked checkCompany(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c,
                                 Map<String, String> partners) {
        Company co = c.id() == null ? null : companies.findById(c.id()).orElse(null);
        if (co == null || co.isHiddenRequest() || !co.getCoordinator().getId().equals(coordinator.getId())
                || !co.getSemester().getId().equals(report.getSemesterId())) {
            return problem(c, "", "Company not found in this report's semester.");
        }
        String who = nz(co.getName());
        String field = c.field() == null ? "" : c.field();
        if (field.equals("supervisorName") || field.equals("supervisorPosition")) {
            // Immediate supervisor ng company (ang ipinapakita kapag walang sariling supervisor ang department)
            String old = SupervisorResolver.clean(field.equals("supervisorName") ? co.getImsupFullname() : co.getImsupPosition());
            String label = field.equals("supervisorName") ? "Immediate supervisor name" : "Immediate supervisor position";
            if (stale(c, old)) return changed(c, who, label, old, clean(c.value()), 0);
            String partnerField = field.equals("supervisorName") ? "supervisorPosition" : "supervisorName";
            String partner = partners.get(COMPANY + ":" + co.getId() + ":" + partnerField);
            try {
                return ok(c, who, companyInfoService.checkCompanySupervisor(co, field, c.value(), partner));
            } catch (ActionException e) {
                return new Checked(c, new ApplyPreviewRow(c.key(), who, label, old, clean(c.value()), 0, e.getMessage()), null);
            }
        }
        if (!field.equals("name") && !field.equals("address")) {
            return problem(c, who, "That field can't be changed from a report.");
        }
        String old = field.equals("name") ? nz(co.getName()) : nz(co.getAddress());
        if (stale(c, old)) return changed(c, who, labelOf(field), old, clean(c.value()), 0);
        try {
            return ok(c, who, companyInfoService.checkCompany(co, field, c.value()));
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, labelOf(field), old, clean(c.value()), 0,
                    e.getMessage()), null);
        }
    }

    // ---- Requirement ----------------------------------------------------

    private Checked checkRequirementTitle(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c) {
        DocumentRequirement r = c.id() == null ? null : requirements.findById(c.id()).orElse(null);
        if (r == null || !r.getCoordinator().getId().equals(coordinator.getId())
                || !r.getSemester().getId().equals(report.getSemesterId())) {
            return problem(c, "", "Requirement not found in this report's semester.");
        }
        String who = nz(r.getTitle());
        if (!"title".equals(c.field())) return problem(c, who, "That field can't be changed from a report.");
        String old = nz(r.getTitle());
        if (stale(c, old)) return changed(c, who, "Requirement title", old, clean(c.value()), 0);
        try {
            PreparedChange p = requirementTitleService.checkRename(r, c.value());
            // Lahat ng student ng coordinator sa semester ang may ganitong requirement
            int affected = students.findForTracking(coordinator.getId(), report.getSemesterId()).size();
            return ok(c, who, new PreparedChange(p.label(), p.oldValue(), p.newValue(), affected, p.write()));
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, "Requirement title", old, clean(c.value()), 0,
                    e.getMessage()), null);
        }
    }

    // ---- Pirmahan ------------------------------------------------------

    private Checked checkSignatory(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c) {
        String field = c.field() == null ? "" : c.field();
        String who = "Signatories (all your reports)";
        Semester semester = semesters.findById(report.getSemesterId()).orElse(null);
        if (semester == null) return problem(c, who, "Semester not found.");
        String fallback = defaultSignatory(reportSourceService.context(coordinator, semester).defaults(), field);
        try {
            PreparedChange p = signatoryService.check(coordinator.getId(), field, c.value(), fallback);
            if (stale(c, p.oldValue())) return changed(c, who, p.label(), p.oldValue(), clean(c.value()), 0);
            return ok(c, who, p);
        } catch (ActionException e) {
            return new Checked(c, new ApplyPreviewRow(c.key(), who, SignatoryService.labelOf(field), "", clean(c.value()), 0,
                    e.getMessage()), null);
        }
    }

    /** Ang default ng system para sa "role.name" o "role.title" */
    private static String defaultSignatory(SignatoryDefaults d, String field) {
        String[] parts = field.split("\\.");
        if (d == null || parts.length != 2) return "";
        Signatory s = switch (parts[0]) {
            case "prepared" -> d.prepared();
            case "programHead" -> d.programHead();
            case "dean" -> d.dean();
            case "chair" -> d.chair();
            default -> null;
        };
        if (s == null) return "";
        return nz(parts[1].equals("name") ? s.name() : s.title());
    }

    // ---------------------------------------------------------------------

    private List<String> sections(Coordinator coordinator, CoordinatorSavedReport report) {
        return students.findForTracking(coordinator.getId(), report.getSemesterId()).stream()
                .map(s -> nz(s.getSubjectCode()))
                .filter(v -> !v.isEmpty())
                .distinct()
                .toList();
    }

    private static Checked ok(ApplyChange c, String who, PreparedChange p) {
        return new Checked(c, new ApplyPreviewRow(c.key(), who, p.label(), p.oldValue(), p.newValue(),
                (int) p.affected(), null), p);
    }

    /** Naiba na ang nasa system mula nang mabuo ang report */
    private static boolean stale(ApplyChange c, String current) {
        return c.expectedOld() != null && !clean(c.expectedOld()).equals(clean(current));
    }

    private static Checked changed(ApplyChange c, String who, String label, String old, String value, int affected) {
        return new Checked(c, new ApplyPreviewRow(c.key(), who, label, old, value, affected,
                "This changed in the system after the report was generated. Regenerate the report and review it again."),
                null);
    }

    private static Checked problem(ApplyChange c, String who, String message) {
        return new Checked(c, new ApplyPreviewRow(c.key(), who, labelOf(c.field()), "", clean(c.value()), 0, message),
                null);
    }

    private static String labelOf(String field) {
        return switch (field == null ? "" : field) {
            case "assignment" -> "Company and department";
            case "section" -> "Section / Subject code";
            case "year" -> "Year";
            case "startDate" -> "Start of training";
            case "title" -> "Requirement title";
            case "completedDate" -> "End of training";
            case "status" -> "Status";
            case "requirement" -> "Requirement";
            case "midterm" -> "Midterm Evaluation";
            case "final" -> "Final Evaluation";
            case "supervisorName" -> "Supervisor name";
            case "supervisorPosition" -> "Supervisor position";
            case "name" -> "Company name";
            case "address" -> "Company address";
            default -> field == null ? "" : field;
        };
    }

    private static String placement(Department d) {
        String dept = SupervisorResolver.clean(d.getName());
        return nz(d.getCompany().getName()) + (dept.isEmpty() ? "" : " – " + dept);
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }
}
