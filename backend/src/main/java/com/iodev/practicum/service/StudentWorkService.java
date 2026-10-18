package com.iodev.practicum.service;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.DocumentRequirementAttachment;
import com.iodev.practicum.model.MonthlyDtr;
import com.iodev.practicum.model.MonthlyWeeklyReport;
import com.iodev.practicum.model.SignedDtr;
import com.iodev.practicum.model.SignedWeeklyReport;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.StudentAttachmentQueries;
import com.iodev.practicum.repository.StudentRequirementQueries;
import com.iodev.practicum.repository.StudentSignedDtrQueries;
import com.iodev.practicum.repository.StudentSignedWeeklyQueries;
import com.iodev.practicum.repository.StudentWeeklyQueries;
import com.iodev.practicum.repository.StudentWorkQueries;
import com.iodev.practicum.util.SubmissionStatus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Pinagsasama ang requirements, weekly reports at DTR ng isang student bilang isang uri ng "gawain",
 * at ang talaan ng ginawa niya (attachment / signed record) para sa bawat isa.
 */
@Service
public class StudentWorkService {

    public static final String REQUIREMENT = "requirement";
    public static final String WEEKLY = "weekly";
    public static final String DTR = "dtr";

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH);

    @Autowired private StudentRequirementQueries requirementQueries;
    @Autowired private StudentAttachmentQueries attachmentQueries;
    @Autowired private StudentWorkQueries dtrQueries;
    @Autowired private StudentWeeklyQueries weeklyQueries;
    @Autowired private StudentSignedDtrQueries signedDtrQueries;
    @Autowired private StudentSignedWeeklyQueries signedWeeklyQueries;

    /** Isang gawain na nakikita ng student, kasama ang kasalukuyang status niya */
    public record Row(String scope, Long id, String title, String subtitle, String type,
                      String instructions, Timestamp dueDate, String template, Timestamp createdAt,
                      String statusKey, Timestamp updatedAt, BigDecimal hours, boolean hasRecord) {}

    public static boolean isInitialOnly(Student s) {
        String status = s.getStatus() == null ? "" : s.getStatus().trim();
        return status.isEmpty() || "for approval".equalsIgnoreCase(status);
    }

    /** Deployed (o Completed na) lang ang may access sa Weekly Report, DTR at Post-Deployment */
    public static boolean isDeployed(Student s) {
        String status = s.getStatus() == null ? "" : s.getStatus().trim();
        return "deployed".equalsIgnoreCase(status) || "completed".equalsIgnoreCase(status);
    }

    public static boolean validScope(String scope) {
        return REQUIREMENT.equals(scope) || WEEKLY.equals(scope) || DTR.equals(scope);
    }

    public static String statusLabel(String key) {
        return switch (key) {
            case "CHECKED" -> SubmissionStatus.CHECKED;
            case "FOR_CHECKING" -> SubmissionStatus.FOR_CHECKING;
            case "INVALID" -> SubmissionStatus.INVALID;
            default -> SubmissionStatus.ASSIGNED;
        };
    }

    public List<Row> rows(Student s) {
        List<Row> out = new ArrayList<>();
        if (s.getCoordinator() == null || s.getSemester() == null) return out;
        Long coordinatorId = s.getCoordinator().getId();
        Long semesterId = s.getSemester().getId();
        boolean initialOnly = isInitialOnly(s);
        boolean deployed = isDeployed(s);

        Map<Long, DocumentRequirementAttachment> att = new HashMap<>();
        for (DocumentRequirementAttachment a : attachmentQueries.findByStudent(s.getId())) {
            att.put(a.getDocumentRequirement().getId(), a);
        }
        for (DocumentRequirement r : requirementQueries.findForStudent(coordinatorId, semesterId)) {
            String type = r.getType() == null ? "" : r.getType().trim().toLowerCase();
            if (initialOnly && !type.equals("initial")) continue;
            if (!deployed && type.startsWith("post")) continue;
            DocumentRequirementAttachment a = att.get(r.getId());
            out.add(new Row(REQUIREMENT, r.getId(), r.getTitle(), null, type, r.getInstructions(),
                    r.getDueDate(), r.getTemplate(), r.getCreatedAt(),
                    a == null ? "ASSIGNED" : SubmissionStatus.key(a.getStatus()),
                    a == null ? null : a.getUpdatedAt(), null, a != null));
        }
        if (initialOnly || !deployed) return out;

        Map<Long, SignedWeeklyReport> weekly = new HashMap<>();
        for (SignedWeeklyReport w : signedWeeklyQueries.findByStudent(s.getId())) {
            weekly.put(w.getMonthlyWeeklyReport().getId(), w);
        }
        for (MonthlyWeeklyReport w : weeklyQueries.weeksFor(coordinatorId, semesterId)) {
            SignedWeeklyReport sw = weekly.get(w.getId());
            String range = w.getMonthFrom() == null || w.getMonthTo() == null ? "Weekly report"
                    : w.getMonthFrom().toLocalDate().format(DAY) + " – " + w.getMonthTo().toLocalDate().format(DAY);
            out.add(new Row(WEEKLY, w.getId(), "Week of " + range, "Weekly report", "pre", w.getRemarks(),
                    w.getDueDate(), w.getTemplate(), w.getCreatedAt(),
                    sw == null ? "ASSIGNED" : SubmissionStatus.key(sw.getStatus()),
                    sw == null ? null : sw.getUpdatedAt(), null, sw != null));
        }

        Map<Long, SignedDtr> dtrs = new HashMap<>();
        for (SignedDtr d : signedDtrQueries.findByStudent(s.getId())) {
            dtrs.put(d.getMonthlyDtr().getId(), d);
        }
        for (MonthlyDtr d : dtrQueries.dtrsFor(coordinatorId, semesterId)) {
            SignedDtr sd = dtrs.get(d.getId());
            out.add(new Row(DTR, d.getId(), d.getMonth() == null ? "DTR" : d.getMonth(), "Daily time record",
                    "pre", null, d.getDueDate(), d.getTemplate(), d.getCreatedAt(),
                    sd == null ? "ASSIGNED" : SubmissionStatus.key(sd.getStatus()),
                    sd == null ? null : sd.getUpdatedAt(), sd == null ? null : sd.getHours(), sd != null));
        }
        return out;
    }

    public Row find(Student s, String scope, Long refId) {
        if (!validScope(scope)) return null;
        for (Row r : rows(s)) {
            if (r.scope().equals(scope) && r.id().equals(refId)) return r;
        }
        return null;
    }

    // ---------------------------------------------------------------------
    // Ang talaan ng ginawa ng student (attachment / signed record)
    // ---------------------------------------------------------------------

    /** Hawak ang talaan ng student para sa isang gawain, anuman ang uri */
    public final class Slot {
        private final Student student;
        private final Row row;
        private DocumentRequirementAttachment att;
        private SignedDtr dtr;
        private SignedWeeklyReport weekly;

        private Slot(Student student, Row row) {
            this.student = student;
            this.row = row;
        }

        public String statusKey() {
            if (att != null) return SubmissionStatus.key(att.getStatus());
            if (dtr != null) return SubmissionStatus.key(dtr.getStatus());
            if (weekly != null) return SubmissionStatus.key(weekly.getStatus());
            return "ASSIGNED";
        }

        public boolean exists() { return att != null || dtr != null || weekly != null; }

        /** Id ng talaan (attachment / signed DTR / signed weekly): ito ang kinakabitan ng private comments */
        public Long id() {
            if (att != null) return att.getId();
            if (dtr != null) return dtr.getId();
            if (weekly != null) return weekly.getId();
            return null;
        }

        public BigDecimal hours() { return dtr == null ? null : dtr.getHours(); }

        public void setHours(BigDecimal hours) {
            if (dtr != null) dtr.setHours(hours);
        }

        public void setStatus(String stored) {
            Timestamp now = new Timestamp(System.currentTimeMillis());
            if (att != null) { att.setStatus(stored); att.setUpdatedAt(now); }
            if (dtr != null) { dtr.setStatus(stored); dtr.setUpdatedAt(now); }
            if (weekly != null) { weekly.setStatus(stored); weekly.setUpdatedAt(now); }
        }

        public void setFilePath(String path) {
            Timestamp now = new Timestamp(System.currentTimeMillis());
            if (att != null) { att.setFilePath(path); att.setUpdatedAt(now); }
            if (dtr != null) { dtr.setFilePath(path); dtr.setUpdatedAt(now); }
            if (weekly != null) { weekly.setFilePath(path); weekly.setUpdatedAt(now); }
        }

        public void save() {
            if (att != null) att = attachmentQueries.save(att);
            if (dtr != null) dtr = signedDtrQueries.save(dtr);
            if (weekly != null) weekly = signedWeeklyQueries.save(weekly);
        }

        public Row row() { return row; }
        public Student student() { return student; }
    }

    /** Ang talaan ng student para sa gawain; kung wala pa at create = true, gagawa nito */
    public Slot slot(Student s, Row row, boolean create) {
        Slot slot = new Slot(s, row);
        switch (row.scope()) {
            case REQUIREMENT -> {
                for (DocumentRequirementAttachment a : attachmentQueries.findByStudent(s.getId())) {
                    if (a.getDocumentRequirement().getId().equals(row.id())) { slot.att = a; break; }
                }
            }
            case DTR -> {
                for (SignedDtr d : signedDtrQueries.findByStudent(s.getId())) {
                    if (d.getMonthlyDtr().getId().equals(row.id())) { slot.dtr = d; break; }
                }
            }
            default -> {
                for (SignedWeeklyReport w : signedWeeklyQueries.findByStudent(s.getId())) {
                    if (w.getMonthlyWeeklyReport().getId().equals(row.id())) { slot.weekly = w; break; }
                }
            }
        }
        if (slot.exists() || !create) return slot;

        Timestamp now = new Timestamp(System.currentTimeMillis());
        switch (row.scope()) {
            case REQUIREMENT -> {
                DocumentRequirementAttachment a = new DocumentRequirementAttachment();
                a.setStudent(s);
                DocumentRequirement ref = new DocumentRequirement();
                ref.setId(row.id());
                a.setDocumentRequirement(ref);
                a.setStatus(SubmissionStatus.ASSIGNED);
                a.setCreatedAt(now);
                a.setUpdatedAt(now);
                slot.att = attachmentQueries.save(a);
            }
            case DTR -> {
                SignedDtr d = new SignedDtr();
                d.setStudent(s);
                MonthlyDtr ref = new MonthlyDtr();
                ref.setId(row.id());
                d.setMonthlyDtr(ref);
                d.setStatus(SubmissionStatus.ASSIGNED);
                d.setCreatedAt(now);
                d.setUpdatedAt(now);
                slot.dtr = signedDtrQueries.save(d);
            }
            default -> {
                SignedWeeklyReport w = new SignedWeeklyReport();
                w.setStudent(s);
                MonthlyWeeklyReport ref = new MonthlyWeeklyReport();
                ref.setId(row.id());
                w.setMonthlyWeeklyReport(ref);
                w.setStatus(SubmissionStatus.ASSIGNED);
                w.setCreatedAt(now);
                w.setUpdatedAt(now);
                slot.weekly = signedWeeklyQueries.save(w);
            }
        }
        return slot;
    }
}
