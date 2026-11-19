package com.iodev.practicum.controller;

import com.iodev.practicum.service.AccountEmailService;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.StudentProfileService;
import com.iodev.practicum.service.SupervisorResolver;
import com.iodev.practicum.dto.StudentManagementDtos.*;
import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.Department;
import com.iodev.practicum.model.Program;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.util.DefaultPassword;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.regex.Pattern;

/**
 * Student management ng coordinator: list, add, inline edit, archive/restore,
 * reset password at detail. (Tinanggal na ang bulk import; nagre-register na ang student gamit ang link.)
 */
@RestController
@RequestMapping("/api/coordinator/student-management")
public class StudentManagementController {


    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentManagementRepository repository;
    @Autowired private com.iodev.practicum.repository.StudentRegistrationRepository registrations;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private StudentProfileService studentProfileService;
    @Autowired private AccountEmailService accountEmails;
    @PersistenceContext private EntityManager em;

    /** Mali ang input; ginagamit sa loob ng mga validator */
    private static class Invalid extends RuntimeException {
        Invalid(String message) { super(message); }
    }

    // ---------------------------------------------------------------------
    // Listahan
    // ---------------------------------------------------------------------

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        List<StudentRow> rows = new ArrayList<>();
        for (Student s : repository.findForManagement(coordinator.getId(), semesterId)) {
            rows.add(toRow(s));
        }
        Program p = coordinator.getProgram();
        return ResponseEntity.ok(new StudentListResponse(
                semesterId,
                p == null ? null : p.getName(),
                p == null ? null : p.getAbbreviation(),
                rows));
    }

    // ---------------------------------------------------------------------
    // Add
    // ---------------------------------------------------------------------

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody StudentCreateRequest r, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        if (r == null || r.semesterId() == null) return bad("Choose a semester first.");

        try {
            String number = validNumber(r.studentNumber());
            String last = validName(r.lastname(), "Last name");
            String first = validName(r.firstname(), "First name");
            String mi = validInitial(r.middleInitial());
            String gender = validGender(r.gender());
            String year = validYear(r.year());
            String course = validCourse(r.course());

            if (repository.numberExists(number, r.semesterId())) {
                return ResponseEntity.status(409).body("That student number already exists in this semester.");
            }

            Student s = build(coordinator, r.semesterId(), number, last, first, mi, gender, year, course);
            repository.save(s);
            return ResponseEntity.ok(toRow(s));
        } catch (Invalid e) {
            return bad(e.getMessage());
        }
    }

    // ---------------------------------------------------------------------
    // Inline edit
    // ---------------------------------------------------------------------

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> edit(@PathVariable Long id, @RequestBody StudentEdit request,
                                  Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        String field = request == null || request.field() == null ? "" : request.field();
        String raw = request == null ? null : request.value();

        // Nasa StudentProfileService ang pagsusuri (iisa para sa Students page at sa mga report)
        try {
            studentProfileService.check(s, field, raw).run();
        } catch (ActionException e) {
            return e.toResponse();
        }

        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    // ---------------------------------------------------------------------
    // Archive / restore / reset password
    // ---------------------------------------------------------------------

    @PatchMapping("/{id}/archive")
    @Transactional
    public ResponseEntity<?> archive(@PathVariable Long id, @RequestParam boolean archived,
                                     Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        s.setIsArchived(archived);
        if (!archived && s.getAccessRevokedAt() != null) {
            // Ibinalik ang student na na-revoke: alisin ang revoke at ibalik ang registration sa "Account created"
            s.setAccessRevokedAt(null);
            s.setAccessRevokeReason(null);
            registrations.findFirstByStudentIdOrderByIdDesc(s.getId())
                    .filter(r -> StudentRegistration.REVOKED.equals(r.getStatus()))
                    .ifPresent(r -> {
                        r.setStatus(StudentRegistration.VERIFIED);
                        r.setRejectReason(null);
                        registrations.save(r);
                    });
        }
        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    /** Ang coordinator ang nagtatakda ng bagong password ng student na may account na */
    @PostMapping("/{id}/password")
    @Transactional
    public ResponseEntity<?> setPassword(@PathVariable Long id, @RequestBody SetPasswordRequest request,
                                         Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (!hasAccount(s)) {
            return ResponseEntity.status(409).body("This student hasn't created an account yet.");
        }

        String password = request == null || request.password() == null ? "" : request.password();
        if (password.length() < 8) return bad("Password must be at least 8 characters.");
        if (password.length() > 72) return bad("Password is too long (max 72 characters).");

        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok().build();
    }

    /** Manu-manong paggawa ng account: email lang ang kailangan; default password (ID + initials) */
    @PostMapping("/{id}/create-account")
    @Transactional
    public ResponseEntity<?> createAccount(@PathVariable Long id, @RequestBody CreateAccountRequest request,
                                           Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (Boolean.TRUE.equals(s.getIsArchived())) return ResponseEntity.status(409).body("Restore the student first.");
        if (hasAccount(s)) return ResponseEntity.status(409).body("This student already has an account.");

        String email = request == null || request.email() == null ? "" : request.email().trim().toLowerCase();
        if (email.isEmpty() || email.length() > 255 || !EMAIL.matcher(email).matches()) return bad("Enter a valid email.");
        if (accountEmails.inUse(email, AccountEmailService.Exclude.student(s.getId()))) {
            return ResponseEntity.status(409).body(AccountEmailService.IN_USE);
        }

        String password = DefaultPassword.of(s);
        s.setEmail(email);
        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setIsVerified(true);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok(new ApprovalResult(s.getId(), s.getLastname() + ", " + s.getFirstname(), email, password));
    }

    /** Ibinabalik ang password sa default (ID + initials); kailangang magpalit ulit ang student */
    @PostMapping("/{id}/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");
        if (!hasAccount(s)) return ResponseEntity.status(409).body("This student hasn't created an account yet.");

        String password = DefaultPassword.of(s);
        s.setPassword(passwordEncoder.encode(password));
        s.setTemporaryPassword(null);
        s.setMustChangePassword(true);
        repository.save(s);
        return ResponseEntity.ok(new ApprovalResult(s.getId(), s.getLastname() + ", " + s.getFirstname(), s.getEmail(), password));
    }

    /** Binabawi ang account: puwedeng mag-claim ulit ang student gamit ang QR */
    @PostMapping("/{id}/reset-account")
    @Transactional
    public ResponseEntity<?> resetAccount(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only edit your own students.");

        s.setEmail(null);
        s.setPassword(unusablePassword());
        s.setTemporaryPassword(null);
        s.setIsVerified(false);
        s.setMustChangePassword(false);
        repository.save(s);
        return ResponseEntity.ok(toRow(s));
    }

    // ---------------------------------------------------------------------
    // Detail (drawer)
    // ---------------------------------------------------------------------

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> detail(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();

        Student s = repository.findById(id).orElse(null);
        if (s == null) return ResponseEntity.notFound().build();
        if (!owns(coordinator, s)) return ResponseEntity.status(403).body("You can only view your own students.");

        Department d = s.getDepartment();
        Company c = d == null ? null : d.getCompany();

        return ResponseEntity.ok(new StudentDetail(
                toRow(s), s.getParent(), s.getGuardian(), s.getMoaStatus(),
                s.getDeployedDate(), s.getStartTrainingDate(), s.getCompletedDate(),
                s.getRenderedHours(), s.getTrainingDuration(),
                c == null ? null : c.getAddress(),
                SupervisorResolver.forDepartment(d).nameOrNull(),
                SupervisorResolver.forDepartment(d).positionOrNull(),
                s.getEmployabilityLevel(),
                new LinkedHashMap<>()));
    }

    // ---------------------------------------------------------------------
    // Validators (nagbabalik ng nilinis na halaga o nagtatapon ng Invalid)
    // ---------------------------------------------------------------------

    /** Ginagawang Invalid ang error ng service, para hindi magbago ang pagdagdag at pag-import */
    private String wrap(java.util.function.Supplier<String> check) {
        try {
            return check.get();
        } catch (ActionException e) {
            throw new Invalid(e.getMessage());
        }
    }

    private String validNumber(String raw) { return wrap(() -> studentProfileService.validNumber(raw)); }

    private String validName(String raw, String label) { return wrap(() -> studentProfileService.validName(raw, label)); }

    private String validInitial(String raw) { return wrap(() -> studentProfileService.validInitial(raw)); }

    private String validGender(String raw) { return wrap(() -> studentProfileService.validGender(raw)); }

    private String validYear(String raw) { return wrap(() -> studentProfileService.validYear(raw)); }

    private String validCourse(String raw) { return wrap(() -> studentProfileService.validCourse(raw)); }

    // ---------------------------------------------------------------------
    // Iba pang helper
    // ---------------------------------------------------------------------

    private Student build(Coordinator coordinator, Long semesterId, String number, String last,
                          String first, String mi, String gender, String year, String course) {
        Student s = new Student();
        s.setCoordinator(coordinator);
        s.setSemester(em.getReference(Semester.class, semesterId));
        s.setSubjectCode(course != null ? course : subjectCodeFor(coordinator, semesterId));
        s.setStudentNumber(number);
        s.setLastname(last);
        s.setFirstname(first);
        s.setMiddleInitial(mi);
        s.setGender(gender);
        s.setYear(year);
        // Walang email o password hangga't hindi nagc-claim ang student sa QR
        s.setPassword(unusablePassword());
        s.setIsVerified(false);
        s.setIsArchived(false);
        s.setMustChangePassword(false);
        return s;
    }

    /** Random na hash na hindi malalaman ninuman; hindi makakapag-login hangga't hindi nagc-claim */
    private String unusablePassword() {
        // 32 hex characters lang: hindi lalampas sa 72-byte limit ng BCrypt
        return passwordEncoder.encode(UUID.randomUUID().toString().replace("-", ""));
    }

    private boolean hasAccount(Student s) {
        return s.getEmail() != null && !s.getEmail().isBlank();
    }

    /** Ang pinakakaraniwang subject code ng coordinator sa semester; kung wala, abbreviation ng program */
    private String subjectCodeFor(Coordinator coordinator, Long semesterId) {
        List<?> found = em.createQuery(
                        "select s.subjectCode from Student s where s.coordinator.id = :c and s.semester.id = :sem "
                                + "group by s.subjectCode order by count(s) desc")
                .setParameter("c", coordinator.getId())
                .setParameter("sem", semesterId)
                .setMaxResults(1)
                .getResultList();
        if (!found.isEmpty() && found.get(0) != null) return found.get(0).toString();
        Program p = coordinator.getProgram();
        return p != null && p.getAbbreviation() != null ? p.getAbbreviation() : "OJT";
    }

    private StudentRow toRow(Student s) {
        Department d = s.getDepartment();
        Company c = d == null ? null : d.getCompany();
        return new StudentRow(
                s.getId(), s.getStudentNumber(), s.getLastname(), s.getFirstname(), s.getMiddleInitial(),
                s.getGender(), s.getYear(), s.getContact(), s.getEmail(), s.getBirthday(), s.getAddress(),
                s.getSubjectCode(), s.getStatus(), Boolean.TRUE.equals(s.getIsArchived()),
                c == null ? null : c.getName(), d == null ? null : SupervisorResolver.departmentLabel(d.getName()),
                hasAccount(s));
    }

    private boolean owns(Coordinator coordinator, Student s) {
        return s.getCoordinator() != null && s.getCoordinator().getId().equals(coordinator.getId());
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }

    private ResponseEntity<?> bad(String message) {
        return ResponseEntity.badRequest().body(message);
    }
}
