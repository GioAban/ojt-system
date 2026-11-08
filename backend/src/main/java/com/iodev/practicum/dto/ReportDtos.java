package com.iodev.practicum.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Laman ng mga report ng coordinator (konteksto, datos mula sa system, at draft) */
public final class ReportDtos {

    private ReportDtos() {}

    public record Signatory(String name, String title) {}

    /** Mga default mula sa system; blangko ang pangalan kapag wala sa system */
    public record SignatoryDefaults(Signatory prepared, Signatory programHead, Signatory dean, Signatory chair) {}

    /**
     * Letterhead, semester at pirmahan. Ang savedSignatories ay JSON ng mga binago ng coordinator
     * sa pirmahan, o null kung wala pa.
     */
    public record Context(
            Long semesterId, String semesterName, String term, String schoolYear,
            String hei, String address,
            String collegeName, String collegeAbbreviation, String collegeLogoPath,
            String programName, String programAbbreviation,
            SignatoryDefaults defaults,
            String savedSignatories) {}

    public record StudentRow(Long id, String lastname, String firstname, String middleInitial, String program,
                             String year, String gender, String status, String startDate, String endDate,
                             Long departmentId, Long companyId) {}

    public record CompanyRow(Long id, String name, String address) {}

    public record DepartmentRow(Long id, Long companyId, String name, String supervisor, String supervisorPosition,
                                int slots, int students) {}

    public record Data(List<StudentRow> students, List<CompanyRow> companies, List<DepartmentRow> departments) {}

    public record DraftData(String content, Long clientUpdatedAt) {}

    public record Detail(Context context, Data data, DraftData draft) {}

    public record SaveRequest(String content, Long clientUpdatedAt) {}

    public record SaveResult(boolean saved, DraftData draft) {}

    public record SignatoriesRequest(String content) {}

    // ---- Datos para sa mga simpleng listahan ----

    /** type: initial, pre o post */
    public record ListRequirement(Long id, String title, String type) {}

    /**
     * Mga status: ASSIGNED, FOR_CHECKING, CHECKED o INVALID (pareho sa tracking).
     * Ang requirementStatuses ay requirement id -> status. Ang started ay may naka-save nang form o
     * signed copy; ang score (percent) ay kasama lang kapag Checked na.
     */
    public record ListStudent(Long id, String studentNumber, String subjectCode,
                              BigDecimal renderedHours, BigDecimal requiredHours,
                              String midtermStatus, boolean midtermOpen, boolean midtermStarted, BigDecimal midtermScore,
                              String finalStatus, boolean finalOpen, boolean finalStarted, BigDecimal finalScore,
                              Map<Long, String> requirementStatuses) {}

    public record ListData(List<ListRequirement> requirements, List<ListStudent> students) {}

    /** Lahat ng datos ng system na kailangan para makabuo ng report */
    public record Source(Context context, Data data, ListData lists) {}

    // ---- Mga naka-save na report ----

    public record SavedSummary(Long id, String type, String title, Long semesterId,
                               Long clientUpdatedAt, String lastEditedBy) {}

    public record SavedDetail(Long id, String type, String title, Long semesterId, String content,
                              Long clientUpdatedAt, String lastEditedBy, Source source) {}

    public record CreateSavedRequest(Long semesterId, String type, String title, String content, Long clientUpdatedAt) {}

    public record UpdateSavedRequest(String title, String content, Long clientUpdatedAt) {}

    /** saved = false: mas bago ang nasa server, at iyon ang ibinalik */
    public record SavedSaveResult(boolean saved, String title, String content, Long clientUpdatedAt) {}

    // ---- Apply to system ----

    /**
     * target: student o department. field: assignment (value = department id), section, year,
     * supervisorName o supervisorPosition. expectedOld: ang nakita ng coordinator; hihinto kapag naiba na ito.
     */
    public record ApplyChange(String target, Long id, String field, String value, String expectedOld) {}

    public record ApplyRequest(List<ApplyChange> changes) {}

    /** problem = null kung ayos; ang lumang halaga ay laging galing sa database */
    public record ApplyPreviewRow(String who, String field, String oldValue, String newValue, int affected, String problem) {}

    public record ApplyPreview(List<ApplyPreviewRow> rows, boolean ok) {}

    public record ApplyResult(int applied, Source source) {}
}
