package com.iodev.practicum.service;

import com.iodev.practicum.dto.ReportDtos.*;
import com.iodev.practicum.model.College;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.CoordinatorReportSignatories;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.CoordinatorReportSignatoriesRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.DocumentRequirementAttachmentRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.SignedEvaluationRepository;
import com.iodev.practicum.repository.StudentRepository;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Binabasa ang datos ng system para sa mga report ng coordinator: letterhead, pirmahan, mga student,
 * company, requirement, oras at evaluation. Pagbasa lang; walang binabago. Laging ang sariling
 * mga student ng coordinator sa semester na iyon lang.
 */
@Service
public class ReportSourceService {

    private static final Pattern SCHOOL_YEAR = Pattern.compile("(\\d{4})\\s*[-–]\\s*(\\d{4})");
    private static final List<String> REQUIREMENT_TYPES = List.of("initial", "pre", "post");

    /** Hindi naka-store sa system; pwedeng palitan ng coordinator sa report */
    private static final String HEI = "URDANETA CITY UNIVERSITY";
    private static final String ADDRESS = "1 San Vicente West, Urdaneta City";

    @Autowired private StudentRepository studentRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private DocumentRequirementAttachmentRepository attachmentRepository;
    @Autowired private CoordinatorReportSignatoriesRepository signatories;
    @Autowired private SignedEvaluationRepository signedEvaluations;
    @Autowired private SubmissionFileRepository submissionFiles;

    public Source source(Coordinator coordinator, Semester semester) {
        return new Source(context(coordinator, semester), data(coordinator, semester.getId()),
                lists(coordinator, semester.getId()));
    }

    public Context context(Coordinator coordinator, Semester semester) {
        Program program = coordinator.getProgram();
        College college = program == null ? null : program.getCollege();

        String semesterName = nz(semester.getSemester());
        Matcher m = SCHOOL_YEAR.matcher(semesterName);
        String schoolYear = "";
        String term = semesterName;
        if (m.find()) {
            schoolYear = m.group(1) + "-" + m.group(2);
            term = nz(semesterName.substring(0, m.start()) + semesterName.substring(m.end()));
        }

        String programAbbr = program == null ? "" : nz(program.getAbbreviation());
        String collegeName = college == null ? "" : nz(college.getName());

        String coordinatorName = coordinator.getUser() == null ? "" : nz(coordinator.getUser().getFullname());
        String titles = nz(coordinator.getProfessionalTitles());
        if (!coordinatorName.isEmpty() && !titles.isEmpty()) coordinatorName = coordinatorName + ", " + titles;

        SignatoryDefaults defaults = new SignatoryDefaults(
                new Signatory(coordinatorName, "College Internship Coordinator"),
                new Signatory(program == null ? "" : nz(program.getProgramHead()),
                        programAbbr.isEmpty() ? "Program Head" : "Program Head, " + programAbbr),
                new Signatory(college == null ? "" : nz(college.getDean()),
                        collegeName.isEmpty() ? "Dean" : "Dean, " + collegeName),
                new Signatory("", "Chair, University Internship Office"));

        String saved = signatories.findByCoordinatorId(coordinator.getId())
                .map(CoordinatorReportSignatories::getContent).orElse(null);

        String logo = college == null || college.getLogo() == null || college.getLogo().isBlank() ? ""
                : "/public/colleges/" + college.getId() + "/logo?v="
                + (college.getUpdatedAt() == null ? 0 : college.getUpdatedAt().getTime());

        return new Context(semester.getId(), semesterName, term, schoolYear, HEI, ADDRESS,
                collegeName, college == null ? "" : nz(college.getAbbreviation()), logo,
                program == null ? "" : nz(program.getName()), programAbbr,
                defaults, saved);
    }

    public Data data(Coordinator coordinator, Long semesterId) {
        Program program = coordinator.getProgram();
        String programAbbr = program == null ? "" : nz(program.getAbbreviation());

        // Mga student ng coordinator na ito sa semester na ito lang (kasama ang department at company)
        List<Student> students = studentRepository.findForTracking(coordinator.getId(), semesterId);
        List<Company> companies = companyRepository.findForAssignment(coordinator.getId(), semesterId);
        List<Department> departments = companies.isEmpty() ? List.of()
                : departmentRepository.findActiveByCompanyIds(companies.stream().map(Company::getId).toList()).stream()
                        .filter(d -> d.getStatus() == null || "approved".equalsIgnoreCase(d.getStatus().trim()))
                        .toList();

        Map<Long, Integer> perDepartment = new HashMap<>();
        List<StudentRow> studentRows = new ArrayList<>();
        for (Student s : students) {
            Department d = s.getDepartment();
            Company c = d == null ? null : d.getCompany();
            if (d != null) perDepartment.merge(d.getId(), 1, Integer::sum);
            String start = nz(s.getStartTrainingDate());
            if (start.isEmpty()) start = nz(s.getDeployedDate());
            studentRows.add(new StudentRow(s.getId(), nz(s.getLastname()), nz(s.getFirstname()), nz(s.getMiddleInitial()),
                    programAbbr, nz(s.getYear()), nz(s.getGender()), nz(s.getStatus()), start, nz(s.getCompletedDate()),
                    d == null ? null : d.getId(), c == null ? null : c.getId(), nz(s.getStartTrainingDate()),
                    nz(s.getContact()), nz(s.getEmail()), nz(s.getBirthday()), nz(s.getAddress()), nz(s.getParent()),
                    nz(s.getGuardian()), StudentProfileService.hasAccount(s)));
        }

        // Mga company na pwedeng pag-assign-an (aktibo ngayong semester)
        Set<Long> assignableCompanies = new HashSet<>();
        companies.forEach(c -> { if (!Boolean.TRUE.equals(c.getIsArchived())) assignableCompanies.add(c.getId()); });
        Set<Long> assignableDepartments = new HashSet<>();
        departments.stream()
                .filter(d -> assignableCompanies.contains(d.getCompany().getId()) && !Boolean.TRUE.equals(d.getIsArchived())
                        && "approved".equalsIgnoreCase(nz(d.getStatus())))
                .forEach(d -> assignableDepartments.add(d.getId()));

        // Kasama rin ang company ng mga student kahit wala na ito sa listahan ng maa-assign (hal. naka-archive)
        Map<Long, Company> allCompanies = new LinkedHashMap<>();
        companies.forEach(c -> allCompanies.put(c.getId(), c));
        for (Student s : students) {
            Company c = s.getDepartment() == null ? null : s.getDepartment().getCompany();
            if (c != null) allCompanies.putIfAbsent(c.getId(), c);
        }

        List<CompanyRow> companyRows = allCompanies.values().stream()
                .map(c -> new CompanyRow(c.getId(), nz(c.getName()),
                        nz(c.getAddress()).isEmpty() ? nz(c.getLocation()) : nz(c.getAddress()),
                        nz(c.getAddress()), assignableCompanies.contains(c.getId()),
                        SupervisorResolver.clean(c.getImsupFullname()), SupervisorResolver.clean(c.getImsupPosition())))
                .toList();

        // Pareho: ang department ng student kahit hindi na aktibo, para hindi mawala ang pangalan
        Map<Long, Department> allDepartments = new LinkedHashMap<>();
        departments.forEach(d -> allDepartments.put(d.getId(), d));
        for (Student s : students) {
            Department d = s.getDepartment();
            if (d != null) allDepartments.putIfAbsent(d.getId(), d);
        }
        List<DepartmentRow> departmentRows = allDepartments.values().stream()
                .map(d -> new DepartmentRow(d.getId(), d.getCompany().getId(), nz(d.getName()),
                        SupervisorResolver.forDepartment(d).name(), SupervisorResolver.forDepartment(d).position(),
                        d.getSlots() == null ? 0 : d.getSlots(), perDepartment.getOrDefault(d.getId(), 0),
                        SupervisorResolver.clean(d.getSupervisorFullname()),
                        SupervisorResolver.clean(d.getSupervisorPosition()),
                        assignableDepartments.contains(d.getId()),
                        // Saan galing ang ipinapakitang supervisor: department, company (fallback), o wala.
                        // Kapareho ng resolver (ang N/A ay company muna), para ang pag-edit ay tumama sa tamang panig.
                        SupervisorResolver.sourceOf(d)))
                .toList();
        return new Data(studentRows, companyRows, departmentRows);
    }

    public ListData lists(Coordinator coordinator, Long semesterId) {
        Long coordinatorId = coordinator.getId();
        List<Student> students = studentRepository.findForTracking(coordinatorId, semesterId);

        // Mga karaniwang requirement lang; hiwalay ang Midterm at Final na built-in
        List<DocumentRequirement> requirements = new ArrayList<>();
        for (String type : REQUIREMENT_TYPES) {
            requirementRepository.findForTracking(coordinatorId, semesterId, type).stream()
                    .filter(r -> !EvaluationAccess.isBuiltIn(r))
                    .forEach(requirements::add);
        }
        Long midtermId = requirementRepository.findBuiltIn(coordinatorId, semesterId, EvaluationAccess.MIDTERM)
                .map(DocumentRequirement::getId).orElse(null);
        Long finalId = requirementRepository.findBuiltIn(coordinatorId, semesterId, EvaluationAccess.FINAL)
                .map(DocumentRequirement::getId).orElse(null);

        Set<Long> ids = new HashSet<>();
        requirements.forEach(r -> ids.add(r.getId()));
        if (midtermId != null) ids.add(midtermId);
        if (finalId != null) ids.add(finalId);

        // "studentId-requirementId" -> pinakamahalagang status (parehong tuntunin ng tracking)
        Map<String, String> statuses = new HashMap<>();
        if (!ids.isEmpty() && !students.isEmpty()) {
            for (Object[] row : attachmentRepository.findStatuses(ids)) {
                statuses.merge(row[0] + "-" + row[1], StudentProgressService.normalize((String) row[2]), StudentProgressService::strongest);
            }
        }

        // Nasimulan na: may naka-save na form o signed copy (hindi pa turned in)
        List<Long> evaluationIds = new ArrayList<>();
        if (midtermId != null) evaluationIds.add(midtermId);
        if (finalId != null) evaluationIds.add(finalId);
        Set<String> started = new HashSet<>();
        Map<String, BigDecimal> scores = new HashMap<>();
        if (!evaluationIds.isEmpty() && !students.isEmpty()) {
            for (Object[] row : signedEvaluations.findForReports(evaluationIds)) {
                String key = row[0] + "-" + row[1];
                started.add(key);
                if (row[2] != null) scores.put(key, (BigDecimal) row[2]);
            }
            for (Object[] row : submissionFiles.uploadsFor(StudentWorkService.REQUIREMENT, evaluationIds)) {
                started.add(row[0] + "-" + row[1]);
            }
        }

        BigDecimal programHours = coordinator.getProgram() == null ? null : coordinator.getProgram().getTrainingDuration();
        List<ListStudent> rows = new ArrayList<>();
        for (Student s : students) {
            Map<Long, String> perRequirement = new LinkedHashMap<>();
            for (DocumentRequirement r : requirements) {
                perRequirement.put(r.getId(), statuses.getOrDefault(s.getId() + "-" + r.getId(), "ASSIGNED"));
            }
            String midtermKey = s.getId() + "-" + midtermId;
            String finalKey = s.getId() + "-" + finalId;
            String midterm = statuses.getOrDefault(midtermKey, "ASSIGNED");
            String fin = statuses.getOrDefault(finalKey, "ASSIGNED");
            rows.add(new ListStudent(s.getId(), nz(s.getStudentNumber()), nz(s.getSubjectCode()),
                    s.getRenderedHours(), s.getTrainingDuration() != null ? s.getTrainingDuration() : programHours,
                    midterm, EvaluationAccess.isOpen(s, EvaluationAccess.MIDTERM), started.contains(midtermKey),
                    "CHECKED".equals(midterm) ? scores.get(midtermKey) : null,
                    fin, EvaluationAccess.isOpen(s, EvaluationAccess.FINAL), started.contains(finalKey),
                    "CHECKED".equals(fin) ? scores.get(finalKey) : null,
                    perRequirement));
        }
        List<ListRequirement> columns = requirements.stream()
                .map(r -> new ListRequirement(r.getId(), nz(r.getTitle()), nz(r.getType()).toLowerCase(),
                        EvaluationAccess.isBuiltIn(r)))
                .toList();
        // Mga section na ginagamit na (para sa dropdown; walang bagong section mula sa report)
        List<String> sections = students.stream()
                .map(s -> nz(s.getSubjectCode()))
                .filter(v -> !v.isEmpty())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .toList();
        return new ListData(columns, rows, sections);
    }

    private static String nz(String v) {
        return v == null ? "" : v.trim();
    }
}
