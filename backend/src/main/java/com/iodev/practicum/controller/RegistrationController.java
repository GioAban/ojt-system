package com.iodev.practicum.controller;

import com.iodev.practicum.dto.RegistrationDtos.BulkIds;
import com.iodev.practicum.dto.RegistrationDtos.BulkResult;
import com.iodev.practicum.dto.RegistrationDtos.RegistrationEdit;
import com.iodev.practicum.dto.RegistrationDtos.RegistrationRow;
import com.iodev.practicum.dto.RegistrationDtos.RejectRequest;
import com.iodev.practicum.dto.RegistrationDtos.ResendResult;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.EmailTokenRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import com.iodev.practicum.service.ActionException;
import com.iodev.practicum.service.EmailTokenService;
import com.iodev.practicum.service.RegistrationEmailService;
import com.iodev.practicum.service.RegistrationService;
import com.iodev.practicum.service.StudentProfileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Registrations ng coordinator: listahan (lahat ng status), pagwawasto, resend ng link, verify (isa o marami)
 * ng naghihintay ng approval, reject, at revoke ng account na nagawa na.
 */
@RestController
@RequestMapping("/api/coordinator/student-management/registrations")
public class RegistrationController {

    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private StudentRegistrationRepository registrations;
    @Autowired private RegistrationService registrationService;
    @Autowired private StudentProfileService profiles;
    @Autowired private RegistrationEmailService registrationEmails;
    @Autowired private EmailTokenService emailTokens;
    @Autowired private EmailTokenRepository tokenRepository;
    @Autowired private StudentManagementRepository students;

    @GetMapping
    @Transactional(readOnly = true)
    public ResponseEntity<?> list(@RequestParam Long semesterId, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        // Lahat ng status: kita ng coordinator kung sino ang awtomatikong nagkaroon ng account (at puwedeng i-Revoke)
        List<StudentRegistration> all = registrations.findAllFor(coordinator.getId(), semesterId);
        Map<Long, LocalDateTime> sent = lastLinkSent(all);
        List<RegistrationRow> rows = new ArrayList<>();
        for (StudentRegistration r : all) rows.add(toRow(r, sent.get(r.getId())));
        return ResponseEntity.ok(rows);
    }

    /** Ayusin ang typo. Ang hindi pa tapos lang (hindi pa verified ang email, o hinihintay ang approval). */
    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> edit(@PathVariable Long id, @RequestBody RegistrationEdit e, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        StudentRegistration r = own(id, coordinator);
        if (r == null) return ResponseEntity.status(404).body("Registration not found.");
        boolean awaitingEmail = StudentRegistration.EMAIL_PENDING.equals(r.getStatus());
        if (!StudentRegistration.PENDING.equals(r.getStatus()) && !awaitingEmail) {
            return ResponseEntity.status(409).body("This registration was already handled.");
        }
        if (e == null) return ResponseEntity.badRequest().body("Nothing to change.");

        boolean emailChanged = false;
        try {
            if (e.email() != null && !e.email().trim().equalsIgnoreCase(r.getEmail())) {
                // Napatunayan na ng student ang email kapag PENDING; huwag nang palitan
                if (!awaitingEmail) {
                    throw ActionException.conflict("This email was already verified by the student, so it can't be changed.");
                }
                String email = profiles.validEmail(e.email());
                if (registrationService.emailTaken(email, r.getId())) {
                    throw ActionException.conflict(RegistrationService.EMAIL_TAKEN);
                }
                r.setEmail(email);
                emailChanged = true;
            }
            if (e.studentNumber() != null) {
                String number = profiles.validNumber(e.studentNumber());
                if (registrationService.numberTaken(number, r.getSemester().getId(), r.getId())) {
                    throw ActionException.conflict("That Student ID already exists in this semester.");
                }
                r.setStudentNumber(number);
            }
            if (e.lastname() != null) r.setLastname(registrationService.name(e.lastname(), "Last name"));
            if (e.firstname() != null) r.setFirstname(registrationService.name(e.firstname(), "First name"));
            if (e.middleInitial() != null) r.setMiddleInitial(registrationService.initial(e.middleInitial()));
            if (e.year() != null) r.setYear(registrationService.year(e.year()));
            if (e.gender() != null) r.setGender(profiles.validGender(e.gender()));
            if (e.course() != null) r.setCourse(registrationService.course(e.course()));
        } catch (ActionException ex) {
            return ex.toResponse();
        }
        registrations.save(r);
        if (emailChanged) {
            // Ang lumang link (sa maling address) ay hindi na gagana; bagong link sa tamang address
            emailTokens.closeAll(EmailToken.REGISTRATION, r.getId(), EmailToken.VERIFY_REGISTRATION);
            registrationEmails.sendVerification(r);
        }
        return ResponseEntity.ok(row(r));
    }

    /** Ipadala ulit ang verification link (hindi pa verified ang email) */
    @PostMapping("/{id}/resend")
    @Transactional
    public ResponseEntity<?> resend(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        StudentRegistration r = own(id, coordinator);
        if (r == null) return ResponseEntity.status(404).body("Registration not found.");
        if (!StudentRegistration.EMAIL_PENDING.equals(r.getStatus())) {
            return ResponseEntity.status(409).body("This student already verified their email.");
        }
        boolean sent = registrationEmails.sendVerification(r);
        return ResponseEntity.ok(new ResendResult(sent, sent
                ? "We sent a new link to " + r.getEmail() + "."
                : "A link was sent to this email recently. Please wait a minute, or try again tomorrow if it was sent many times today."));
    }

    /** Alisin ang access ng account na nagawa na; naka-archive ang student at sinasabihan sa email */
    @PostMapping("/{id}/revoke")
    @Transactional
    public ResponseEntity<?> revoke(@PathVariable Long id, @RequestBody(required = false) RejectRequest body,
                                    Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        StudentRegistration r = own(id, coordinator);
        if (r == null) return ResponseEntity.status(404).body("Registration not found.");
        Student s = r.getStudentId() == null ? null : students.findById(r.getStudentId()).orElse(null);
        if (s != null && (s.getCoordinator() == null || !s.getCoordinator().getId().equals(coordinator.getId()))) {
            return ResponseEntity.status(403).body("You can only revoke your own students.");
        }
        try {
            registrationService.revoke(r, s, body == null ? null : body.reason());
        } catch (ActionException ex) {
            return ex.toResponse();
        }
        return ResponseEntity.ok(row(r));
    }

    @PostMapping("/{id}/verify")
    @Transactional
    public ResponseEntity<?> verify(@PathVariable Long id, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        StudentRegistration r = own(id, coordinator);
        if (r == null) return ResponseEntity.status(404).body("Registration not found.");
        try {
            registrationService.verify(r);
        } catch (ActionException ex) {
            return ex.toResponse();
        }
        return ResponseEntity.ok(row(r));
    }

    /** I-verify ang mga pinili; ang may problema (hal. kaparehong ID) ay nilalaktawan */
    @PostMapping("/bulk-verify")
    @Transactional
    public ResponseEntity<?> bulkVerify(@RequestBody BulkIds body, Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        int done = 0, skipped = 0;
        List<String> problems = new ArrayList<>();
        if (body != null && body.ids() != null) {
            for (Long id : body.ids().stream().filter(Objects::nonNull).distinct().limit(500).toList()) {
                StudentRegistration r = own(id, coordinator);
                if (r == null) continue;
                try {
                    registrationService.verify(r);
                    done++;
                } catch (ActionException ex) {
                    skipped++;
                    problems.add(r.getLastname() + ", " + r.getFirstname() + ": " + ex.getMessage());
                }
            }
        }
        return ResponseEntity.ok(new BulkResult(done, skipped, problems));
    }

    @PostMapping("/{id}/reject")
    @Transactional
    public ResponseEntity<?> reject(@PathVariable Long id, @RequestBody(required = false) RejectRequest body,
                                    Authentication authentication) {
        Coordinator coordinator = current(authentication);
        if (coordinator == null) return noProfile();
        StudentRegistration r = own(id, coordinator);
        if (r == null) return ResponseEntity.status(404).body("Registration not found.");
        try {
            registrationService.reject(r, body == null ? null : body.reason());
        } catch (ActionException ex) {
            return ex.toResponse();
        }
        return ResponseEntity.ok(row(r));
    }

    // ---------------------------------------------------------------------

    /** Ang registration kung pag-aari ng coordinator na ito; null kung hindi */
    private StudentRegistration own(Long id, Coordinator coordinator) {
        StudentRegistration r = registrations.findById(id).orElse(null);
        return r != null && r.getCoordinator().getId().equals(coordinator.getId()) ? r : null;
    }

    /** Isang row, kasama kung kailan huling naipadala ang link */
    private RegistrationRow row(StudentRegistration r) {
        return toRow(r, lastLinkSent(List.of(r)).get(r.getId()));
    }

    private RegistrationRow toRow(StudentRegistration r, LocalDateTime linkSentAt) {
        return new RegistrationRow(r.getId(), r.getStudentNumber(), r.getLastname(), r.getFirstname(),
                r.getMiddleInitial(), r.getYear(), r.getGender(), r.getCourse(), r.getEmail(), r.getStatus(),
                r.getRejectReason(),
                r.getCreatedAt() == null ? null : r.getCreatedAt().toString(),
                r.getDecidedAt() == null ? null : r.getDecidedAt().toString(),
                r.getEmailVerifiedAt() != null,
                linkSentAt == null ? null : linkSentAt.toString(),
                r.getStudentId());
    }

    private Map<Long, LocalDateTime> lastLinkSent(List<StudentRegistration> list) {
        Map<Long, LocalDateTime> out = new HashMap<>();
        List<Long> ids = list.stream().filter(r -> StudentRegistration.EMAIL_PENDING.equals(r.getStatus()))
                .map(StudentRegistration::getId).toList();
        if (ids.isEmpty()) return out;
        for (Object[] row : tokenRepository.lastSentFor(EmailToken.REGISTRATION, EmailToken.VERIFY_REGISTRATION, ids)) {
            out.put((Long) row[0], (LocalDateTime) row[1]);
        }
        return out;
    }

    private Coordinator current(Authentication authentication) {
        return coordinatorRepository.findByUserEmail(authentication.getName()).orElse(null);
    }

    private ResponseEntity<?> noProfile() {
        return ResponseEntity.status(403).body("Coordinator profile not found.");
    }
}
