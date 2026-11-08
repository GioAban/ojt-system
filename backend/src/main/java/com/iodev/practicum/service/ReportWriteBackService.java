package com.iodev.practicum.service;

import com.iodev.practicum.dto.ReportDtos.ApplyChange;
import com.iodev.practicum.dto.ReportDtos.ApplyPreview;
import com.iodev.practicum.dto.ReportDtos.ApplyPreviewRow;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorReportAudit;
import com.iodev.practicum.model.CoordinatorSavedReport;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentDepartmentHistory;
import com.iodev.practicum.repository.CoordinatorReportAuditRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentDepartmentHistoryRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * "Apply to system" mula sa report. Ito lang ang mga field na pwedeng isulat pabalik:
 * company at department ng student (paglipat lang), section/subject code, year,
 * at pangalan at posisyon ng supervisor ng department. Wala nang iba: hindi kailanman ang status,
 * oras, score, petsa o MOA. Tinitingnan ulit ang lahat sa server bago sumulat, at lahat o wala ang napapalitan.
 */
@Service
public class ReportWriteBackService {

    private static final String STUDENT = "student";
    private static final String DEPARTMENT = "department";
    private static final Map<String, String> YEARS = Map.of(
            "1", "1st Year", "2", "2nd Year", "3", "3rd Year", "4", "4th Year", "5", "5th Year");

    @Autowired private StudentRepository students;
    @Autowired private DepartmentRepository departments;
    @Autowired private StudentDepartmentHistoryRepository history;
    @Autowired private CoordinatorReportAuditRepository audits;

    /** Isang pagbabagong nasuri na; null ang write kapag may problema */
    private record Checked(ApplyPreviewRow row, Runnable write) {}

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
        for (int i = 0; i < checked.size(); i++) {
            checked.get(i).write().run();
            ApplyChange change = changes.get(i);
            ApplyPreviewRow row = rows.get(i);
            CoordinatorReportAudit a = new CoordinatorReportAudit();
            a.setCoordinatorId(coordinator.getId());
            a.setActorName(actor);
            a.setReportId(report.getId());
            a.setSemesterId(report.getSemesterId());
            a.setTargetType(change.target());
            a.setTargetId(change.id());
            a.setTargetLabel(row.who());
            a.setField(change.field());
            a.setOldValue(row.oldValue());
            a.setNewValue(row.newValue());
            a.setAffectedCount(row.affected());
            audits.save(a);
        }
        return null;
    }

    private List<Checked> check(Coordinator coordinator, CoordinatorSavedReport report, List<ApplyChange> changes) {
        List<Checked> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        // Ilang student ang papasok sa bawat department sa kahilingang ito
        Map<Long, Integer> incoming = new HashMap<>();
        for (ApplyChange c : changes) {
            String key = c.target() + ":" + c.id() + ":" + c.field();
            if (!seen.add(key)) {
                out.add(problem(c, "This record appears more than once in the list."));
            } else if (STUDENT.equals(c.target())) {
                out.add(checkStudent(coordinator, report, c, incoming));
            } else if (DEPARTMENT.equals(c.target())) {
                out.add(checkDepartment(coordinator, report, c));
            } else {
                out.add(problem(c, "That record can't be changed from a report."));
            }
        }
        return out;
    }

    private Checked checkStudent(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c,
                                 Map<Long, Integer> incoming) {
        Student s = c.id() == null ? null : students.findById(c.id()).orElse(null);
        // Hindi sinasabi kung may ganitong student na hindi sa kaniya
        if (s == null || !s.getCoordinator().getId().equals(coordinator.getId())
                || !s.getSemester().getId().equals(report.getSemesterId())
                || Boolean.TRUE.equals(s.getIsArchived())) {
            return problem(c, "Student not found in this report's semester.");
        }
        String who = s.getLastname() + ", " + s.getFirstname();
        String value = clean(c.value());
        return switch (c.field() == null ? "" : c.field()) {
            case "section" -> {
                String old = nz(s.getSubjectCode());
                if (value.isEmpty()) yield row(who, "Section / Subject code", old, value, 1, "Section is required.");
                if (value.length() > 50) yield row(who, "Section / Subject code", old, value, 1, "Section is too long (max 50 characters).");
                yield simple(c, who, "Section / Subject code", old, value, () -> {
                    s.setSubjectCode(value);
                    students.save(s);
                });
            }
            case "year" -> {
                String old = nz(s.getYear());
                String year = year(value);
                if (year == null) yield row(who, "Year", old, value, 1, "Year must be from 1st Year to 5th Year.");
                yield simple(c, who, "Year", old, year, () -> {
                    s.setYear(year);
                    students.save(s);
                });
            }
            case "assignment" -> checkAssignment(coordinator, s, who, c, incoming);
            default -> row(who, "This field", "", value, 0, "That field can't be changed from a report.");
        };
    }

    private Checked checkAssignment(Coordinator coordinator, Student s, String who, ApplyChange c,
                                    Map<Long, Integer> incoming) {
        final String label = "Company and department";
        Department current = s.getDepartment();
        String old = current == null ? "" : placement(current);
        // Ang unang pag-assign at ang pag-alis ay nakakabit sa status: sa Students page lang ang mga iyon
        if (current == null) {
            return row(who, label, old, "", 1, "This student has no company yet. Assign the first one on the Students page.");
        }
        Department target;
        try {
            target = departments.findById(Long.valueOf(clean(c.value()))).orElse(null);
        } catch (NumberFormatException e) {
            target = null;
        }
        if (target == null) return row(who, label, old, "", 1, "Choose a department.");
        String next = placement(target);
        if ("Completed".equalsIgnoreCase(s.getStatus())) {
            return row(who, label, old, next, 1, "This student has completed the OJT, so the company can't be changed.");
        }
        if (c.expectedOld() != null && !c.expectedOld().equals(String.valueOf(current.getId()))) {
            return row(who, label, old, next, 1, changedMessage());
        }
        if (target.getId().equals(current.getId())) return row(who, label, old, next, 1, "There's nothing to change.");

        Company company = target.getCompany();
        if (!company.getCoordinator().getId().equals(coordinator.getId())) {
            return row(who, label, old, "", 1, "That company doesn't belong to you.");
        }
        if (!company.getSemester().getId().equals(s.getSemester().getId())) {
            return row(who, label, old, next, 1, "That company belongs to a different semester.");
        }
        if (Boolean.TRUE.equals(company.getIsArchived()) || Boolean.TRUE.equals(target.getIsArchived())) {
            return row(who, label, old, next, 1, "That company or department is archived.");
        }
        if (!"approved".equalsIgnoreCase(target.getStatus())) {
            return row(who, label, old, next, 1, "That department isn't approved yet.");
        }
        long filled = 0;
        for (Object[] count : students.countByDepartmentIds(List.of(target.getId()))) filled = (Long) count[1];
        int coming = incoming.merge(target.getId(), 1, Integer::sum);
        int slots = target.getSlots() == null ? 0 : target.getSlots();
        if (filled + coming > slots) return row(who, label, old, next, 1, "This department has no slots left.");

        Department destination = target;
        return new Checked(new ApplyPreviewRow(who, label, old, next, 1, null), () -> transfer(s, destination));
    }

    /** Parehong tala ng kasaysayan sa karaniwang pag-assign; hindi ginagalaw ang status */
    private void transfer(Student s, Department target) {
        Timestamp now = new Timestamp(System.currentTimeMillis());
        List<StudentDepartmentHistory> open = history.findByStudentIdAndEndedAtIsNull(s.getId());
        open.forEach(h -> h.setEndedAt(now));
        history.saveAll(open);

        StudentDepartmentHistory entry = new StudentDepartmentHistory();
        entry.setStudent(s);
        entry.setDepartment(target);
        entry.setType("transferred");
        entry.setStartedAt(now);
        history.save(entry);

        s.setDepartment(target);
        students.save(s);
    }

    private Checked checkDepartment(Coordinator coordinator, CoordinatorSavedReport report, ApplyChange c) {
        Department d = c.id() == null ? null : departments.findById(c.id()).orElse(null);
        if (d == null || !d.getCompany().getCoordinator().getId().equals(coordinator.getId())
                || !d.getCompany().getSemester().getId().equals(report.getSemesterId())) {
            return problem(c, "Department not found in this report's semester.");
        }
        long filled = 0;
        for (Object[] count : students.countByDepartmentIds(List.of(d.getId()))) filled = (Long) count[1];
        int affected = (int) filled;
        String who = placement(d);
        String value = clean(c.value());
        return switch (c.field() == null ? "" : c.field()) {
            case "supervisorName" -> {
                String old = nz(d.getSupervisorFullname());
                if (value.isEmpty()) yield row(who, "Supervisor name", old, value, affected, "The supervisor's name is required.");
                if (value.length() > 255) yield row(who, "Supervisor name", old, value, affected, "The supervisor's name is too long (max 255 characters).");
                yield departmentChange(c, who, "Supervisor name", old, value, affected, () -> {
                    d.setSupervisorFullname(value);
                    departments.save(d);
                });
            }
            case "supervisorPosition" -> {
                String old = nz(d.getSupervisorPosition());
                if (value.length() > 255) yield row(who, "Supervisor position", old, value, affected, "The position is too long (max 255 characters).");
                yield departmentChange(c, who, "Supervisor position", old, value, affected, () -> {
                    d.setSupervisorPosition(value);
                    departments.save(d);
                });
            }
            default -> row(who, "This field", "", value, 0, "That field can't be changed from a report.");
        };
    }

    private Checked simple(ApplyChange c, String who, String label, String old, String value, Runnable write) {
        return departmentChange(c, who, label, old, value, 1, write);
    }

    private Checked departmentChange(ApplyChange c, String who, String label, String old, String value,
                                     int affected, Runnable write) {
        if (c.expectedOld() != null && !clean(c.expectedOld()).equals(old)) {
            return row(who, label, old, value, affected, changedMessage());
        }
        if (old.equals(value)) return row(who, label, old, value, affected, "There's nothing to change.");
        return new Checked(new ApplyPreviewRow(who, label, old, value, affected, null), write);
    }

    private static Checked row(String who, String label, String old, String value, int affected, String problem) {
        return new Checked(new ApplyPreviewRow(who, label, old, value, affected, problem), null);
    }

    private static Checked problem(ApplyChange c, String message) {
        return row("", c.field() == null ? "" : c.field(), "", clean(c.value()), 0, message);
    }

    private static String changedMessage() {
        return "This changed in the system after the report was generated. Regenerate the report and review it again.";
    }

    private static String placement(Department d) {
        return nz(d.getCompany().getName()) + " – " + nz(d.getName());
    }

    /** "4", "4th", "4th year" -> "4th Year"; null kung hindi valid (parehong tuntunin ng Students page) */
    private static String year(String raw) {
        String digit = raw.replaceAll("[^0-9]", "");
        return YEARS.get(digit);
    }

    private static String clean(String v) {
        return v == null ? "" : v.trim();
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }
}
