package com.iodev.practicum.controller;

import com.iodev.practicum.service.SupervisorResolver;
import com.iodev.practicum.dto.StudentProfileDtos.CompaniesResponse;
import com.iodev.practicum.dto.StudentProfileDtos.CompanyDepartment;
import com.iodev.practicum.dto.StudentProfileDtos.CompanyEntry;
import com.iodev.practicum.dto.StudentProfileDtos.HomeResponse;
import com.iodev.practicum.dto.StudentProfileDtos.WorkCard;
import com.iodev.practicum.repository.SubmissionFileRepository;
import com.iodev.practicum.service.PrivacySettings;
import com.iodev.practicum.service.StudentWorkService;
import com.iodev.practicum.dto.StudentProfileDtos.Profile;
import com.iodev.practicum.dto.StudentProfileDtos.ProfileDetails;
import com.iodev.practicum.dto.RegistrationDtos.CompleteProfileRequest;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.FieldErrors;
import com.iodev.practicum.service.StudentProfileService;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CompanyRepository;
import com.iodev.practicum.repository.DepartmentRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.function.Supplier;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Ang sariling impormasyon ng student at ang mga company na pwede niyang pasukan. */
@RestController
@RequestMapping("/api/student")
public class StudentProfileController {

    /** Mga status na pwede nang mag-apply sa company */
    private static final Set<String> CAN_APPLY = Set.of("approved");

    @Autowired private StudentManagementRepository studentManagementRepository;
    @Autowired private StudentRepository studentRepository;
    @Autowired private CompanyRepository companyRepository;
    @Autowired private DepartmentRepository departmentRepository;
    @Autowired private SubmissionFileRepository submissionFiles;
    @Autowired private StudentWorkService workService;
    @Autowired private PrivacySettings privacySettings;
    @Autowired private StudentProfileService studentProfiles;
    @Autowired private com.iodev.practicum.service.SkillService skillService;

    @GetMapping("/profile")
    @Transactional(readOnly = true)
    public ResponseEntity<?> profile(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        Coordinator coordinator = s.getCoordinator();
        String coordinatorName = coordinator == null || coordinator.getUser() == null
                ? null : coordinator.getUser().getFullname();

        Department d = s.getDepartment();
        return ResponseEntity.ok(new Profile(
                s.getId(), s.getStudentNumber(), s.getFirstname(), s.getLastname(), s.getEmail(),
                s.getStatus(), s.getSemester() == null ? null : s.getSemester().getSemester(),
                coordinatorName,
                d == null ? null : d.getCompany().getName(),
                d == null ? null : SupervisorResolver.departmentLabel(d.getName()),
                s.getRenderedHours(), requiredHours(s, coordinator),
                Boolean.TRUE.equals(s.getMustChangePassword()),
                !privacySettings.needsAcknowledgement(s.getPrivacyAckVersion()),
                s.needsProfile(),
                new ProfileDetails(s.getMiddleInitial(), s.getGender(), s.getYear(), s.getSubjectCode(),
                        s.getContact(), s.getBirthday(), s.getAddress(), s.getParent(), s.getGuardian())));
    }

    /**
     * Isang beses na "Complete your profile" ng student na nag-register sa link.
     * Parehong pagsusuri ng Students page; ibinabalik ang error bawat field.
     */
    @PutMapping("/profile/complete")
    @Transactional
    public ResponseEntity<?> completeProfile(@RequestBody CompleteProfileRequest r, Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");
        if (!s.needsProfile()) return ResponseEntity.status(409).body("Your profile is already complete.");
        if (r == null) return ResponseEntity.badRequest().body("Fill in the form.");

        FieldErrors errors = new FieldErrors();
        String contact = required(errors, "contact", "Contact number", () -> studentProfiles.validContact(r.contact()));
        String birthday = required(errors, "birthday", "Birthday", () -> studentProfiles.validBirthday(r.birthday()));
        String address = required(errors, "address", "Address", () -> studentProfiles.validAddress(r.address()));
        String parent = required(errors, "parent", "Parent's name", () -> studentProfiles.validShortText(r.parent(), "Parent's name"));
        String guardian = null;
        try {
            guardian = studentProfiles.validShortText(r.guardian(), "Guardian's name");
        } catch (ActionException e) {
            errors.add("guardian", e.getMessage());
        }
        if (!errors.isEmpty()) return errors.toResponse();

        s.setContact(contact);
        s.setBirthday(birthday);
        s.setAddress(address);
        s.setParent(parent);
        s.setGuardian(guardian);
        s.setProfileCompletedAt(LocalDateTime.now());
        studentRepository.save(s);
        return ResponseEntity.ok().build();
    }

    /** Kailangang may laman; ang mensahe ng validator ang gamit kapag mali ang anyo */
    private static String required(FieldErrors errors, String key, String label, Supplier<String> check) {
        try {
            String v = check.get();
            if (v == null || v.isBlank()) errors.add(key, label + " is required.");
            return v;
        } catch (ActionException e) {
            errors.add(key, e.getMessage());
            return null;
        }
    }

    /**
     * Home ng student: lahat ng gawain niya (requirements, weekly reports, DTR) bilang cards.
     * Habang "For Approval" pa ang student, Initial requirements lang ang makikita niya.
     */
    @GetMapping("/requirements")
    @Transactional(readOnly = true)
    public ResponseEntity<?> requirements(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        String status = s.getStatus() == null ? "" : s.getStatus();
        Set<String> worked = new java.util.HashSet<>();
        for (Object[] w : submissionFiles.workedOn(s.getId())) worked.add(w[0] + ":" + w[1]);

        List<WorkCard> cards = new ArrayList<>();
        for (StudentWorkService.Row r : workService.rows(s)) {
            boolean hasWork = worked.contains(r.scope() + ":" + r.id());
            cards.add(new WorkCard(r.scope(), r.id(), r.title(), r.subtitle(), r.type(), r.instructions(),
                    r.dueDate() == null ? null : r.dueDate().toInstant().toString(),
                    StudentWorkService.statusLabel(r.statusKey()), hasWork, r.closed(), r.locked(), r.systemKey()));
        }
        return ResponseEntity.ok(new HomeResponse(status, cards));
    }

    @GetMapping("/companies")
    @Transactional(readOnly = true)
    public ResponseEntity<?> companies(Authentication authentication) {
        Student s = current(authentication);
        if (s == null) return ResponseEntity.status(403).body("Student account not found.");

        String status = s.getStatus() == null ? "" : s.getStatus();
        boolean canApply = CAN_APPLY.contains(status.trim().toLowerCase());

        if (s.getCoordinator() == null || s.getSemester() == null) {
            return ResponseEntity.ok(new CompaniesResponse(status, canApply, List.of()));
        }

        List<Company> companies = companyRepository.findForAssignment(
                s.getCoordinator().getId(), s.getSemester().getId());
        if (companies.isEmpty()) return ResponseEntity.ok(new CompaniesResponse(status, canApply, List.of()));

        List<Long> companyIds = companies.stream().map(Company::getId).toList();
        List<Department> departments = departmentRepository.findActiveByCompanyIds(companyIds).stream()
                .filter(d -> "approved".equalsIgnoreCase(d.getStatus()))
                .toList();

        Map<Long, Integer> filled = new HashMap<>();
        if (!departments.isEmpty()) {
            for (Object[] row : studentRepository.countByDepartmentIds(
                    departments.stream().map(Department::getId).toList())) {
                filled.put((Long) row[0], ((Long) row[1]).intValue());
            }
        }

        Map<Long, List<CompanyDepartment>> byCompany = new HashMap<>();
        for (Department d : departments) {
            byCompany.computeIfAbsent(d.getCompany().getId(), k -> new ArrayList<>())
                    .add(new CompanyDepartment(d.getId(), d.getName() == null ? "N/A" : d.getName(),
                            d.getSlots() == null ? 0 : d.getSlots(), filled.getOrDefault(d.getId(), 0)));
        }

        Map<Long, List<String>> skillsOf = skillService.companySkills(companyIds);
        List<CompanyEntry> out = new ArrayList<>();
        for (Company c : companies) {
            List<CompanyDepartment> deps = byCompany.get(c.getId());
            if (deps == null || deps.isEmpty()) continue; // wala pang approved na department
            out.add(new CompanyEntry(c.getId(), c.getName(), c.getAddress(), c.getLocation(),
                    c.getContactNumber(), null, deps, skillsOf.getOrDefault(c.getId(), List.of())));
        }
        out.sort(Comparator.comparing(CompanyEntry::name, String.CASE_INSENSITIVE_ORDER));

        return ResponseEntity.ok(new CompaniesResponse(status, canApply, out));
    }

    /** Kung may account ang email sa higit sa isang semester, ang pinakabago ang gagamitin */
    private Student current(Authentication authentication) {
        if (authentication == null) return null;
        return studentManagementRepository.findByEmail(authentication.getName()).stream()
                .max(Comparator.comparing(Student::getId))
                .orElse(null);
    }

    /** Ang sa student kung meron, kung wala ay ang training duration ng program ng coordinator */
    private static BigDecimal requiredHours(Student s, Coordinator coordinator) {
        if (s.getTrainingDuration() != null) return s.getTrainingDuration();
        return coordinator == null || coordinator.getProgram() == null
                ? null : coordinator.getProgram().getTrainingDuration();
    }
}
