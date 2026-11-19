package com.iodev.practicum.service;

import com.iodev.practicum.mail.MailService;
import com.iodev.practicum.mail.MailTemplates;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentNotification;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.StudentNotificationRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Pagpaparehistro ng student gamit ang link: paglinis ng pangalan, pagsusuri ng kapareho,
 * pag-verify (dito lang ginagawa ang Student) at pag-reject.
 * Iisang pagsusuri ang gamit ng public na form at ng pagwawasto ng coordinator.
 */
@Service
public class RegistrationService {

    public static final int PASSWORD_MIN = 8;
    public static final int PASSWORD_MAX_BYTES = 72; // hangganan ng BCrypt

    public static final String NUMBER_TAKEN =
            "This Student ID is already registered for this semester. If this is you, contact your coordinator.";
    public static final String EMAIL_TAKEN = AccountEmailService.IN_USE;

    @Autowired private StudentProfileService profiles;
    @Autowired private StudentManagementRepository students;
    @Autowired private StudentRegistrationRepository registrations;
    @Autowired private StudentNotificationRepository studentNotifications;
    @Autowired private MailService mail;
    @Autowired private EmailTokenService emailTokens;
    @Autowired private AccountEmailService accountEmails;

    // ---------------------------------------------------------------------
    // Paglinis at pagsusuri
    // ---------------------------------------------------------------------

    /**
     * Parehong tuntunin ng Students page (trim, isang espasyo lang), at kapag puro maliit o puro
     * malaking titik ang tinype ay ginagawang "Juan Dela Cruz". Ang may halong laki (hal. "de la Cruz") ay iniiwan.
     */
    public String name(String raw, String label) {
        String v = profiles.validName(raw, label);
        boolean allLower = v.equals(v.toLowerCase(Locale.ROOT));
        boolean allUpper = v.equals(v.toUpperCase(Locale.ROOT));
        return allLower || allUpper ? capitalise(v) : v;
    }

    static String capitalise(String v) {
        StringBuilder out = new StringBuilder(v.length());
        boolean start = true;
        for (char ch : v.toLowerCase(Locale.ROOT).toCharArray()) {
            out.append(start ? Character.toUpperCase(ch) : ch);
            // Bagong salita pagkatapos ng espasyo, gitling, o apostrophe (hal. Dela Cruz, Anne-Marie, O'Neil)
            start = ch == ' ' || ch == '-' || ch == '\'';
        }
        return out.toString();
    }

    /** Isang letra lang, malaking titik; walang laman = null */
    public String initial(String raw) {
        String v = raw == null ? "" : raw.trim().replace(".", "");
        if (v.isEmpty()) return null;
        if (v.length() != 1 || !Character.isLetter(v.charAt(0))) {
            throw ActionException.bad("Middle initial must be one letter.");
        }
        return v.toUpperCase(Locale.ROOT);
    }

    public String year(String raw) {
        String v = profiles.validYear(raw);
        if (v == null) throw ActionException.bad("Year is required.");
        return v;
    }

    public String gender(String raw) {
        try {
            return profiles.validGender(raw);
        } catch (ActionException e) {
            throw ActionException.bad("Choose your sex at birth.");
        }
    }

    public String course(String raw) {
        String v = profiles.validCourse(raw);
        if (v == null) throw ActionException.bad("Course / section is required.");
        return v;
    }

    /** Walang mensahe = puwede ang password */
    public String passwordProblem(String password, String confirm, String studentNumber) {
        return passwordProblemFor(password, confirm, studentNumber);
    }

    /** Parehong tuntunin ng registration (ginagamit din ng password reset) */
    public static String passwordProblemFor(String password, String confirm, String studentNumber) {
        if (password == null || password.length() < PASSWORD_MIN) {
            return "Password must be at least " + PASSWORD_MIN + " characters.";
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > PASSWORD_MAX_BYTES) {
            return "Password is too long (max 72 characters).";
        }
        if (studentNumber != null && password.trim().equalsIgnoreCase(studentNumber.trim())) {
            return "Don't use your Student ID as your password.";
        }
        if (confirm == null || !confirm.equals(password)) return "Passwords don't match.";
        return null;
    }

    /** Ginagamit na ang Student ID sa semester (student o pending/verified na registration) */
    public boolean numberTaken(String number, Long semesterId, Long excludeRegistrationId) {
        return students.numberExists(number, semesterId)
                || registrations.numberTaken(number, semesterId, excludeRegistrationId);
    }

    /** Ginagamit na ang email kahit saan (users, directors, students, PENDING na registration); tingnan ang AccountEmailService */
    public boolean emailTaken(String email, Long excludeRegistrationId) {
        return accountEmails.inUse(email, AccountEmailService.Exclude.registration(excludeRegistrationId));
    }

    // ---------------------------------------------------------------------
    // Verify at reject
    // ---------------------------------------------------------------------

    /**
     * Pag-verify ng coordinator (PENDING lang). Kapag na-verify na ng student ang email, pinapadalhan siya
     * ng "Your account is ready". 409 kapag may kapareho na o naayos na.
     */
    public Student verify(StudentRegistration r) {
        if (!StudentRegistration.PENDING.equals(r.getStatus())) {
            throw ActionException.conflict("This registration was already handled.");
        }
        Student s = createAccount(r);
        if (r.getEmailVerifiedAt() != null) {
            mail.send(s.getEmail(), MailTemplates.accountReady(collegeOf(r.getCoordinator()), s.getFirstname(),
                    mail.webUrl("/login")));
        }
        return s;
    }

    /**
     * Ginagawa ang Student mula sa registration (ang dating Verify ng coordinator). Ginagamit din kapag
     * awtomatikong nagagawa ang account pagka-verify ng email. 409 kapag may kapareho na.
     */
    public Student createAccount(StudentRegistration r) {
        Long semesterId = r.getSemester().getId();
        if (numberTaken(r.getStudentNumber(), semesterId, r.getId())) {
            throw ActionException.conflict("Student ID " + r.getStudentNumber()
                    + " already exists in this semester. Fix the ID or reject this registration.");
        }
        if (emailTaken(r.getEmail(), r.getId())) {
            throw ActionException.conflict(AccountEmailService.IN_USE + " Reject this registration.");
        }

        Student s = new Student();
        s.setCoordinator(r.getCoordinator());
        s.setSemester(r.getSemester());
        s.setSubjectCode(r.getCourse());
        s.setStudentNumber(r.getStudentNumber());
        s.setLastname(r.getLastname());
        s.setFirstname(r.getFirstname());
        s.setMiddleInitial(r.getMiddleInitial());
        s.setGender(r.getGender());
        s.setYear(r.getYear());
        s.setEmail(r.getEmail());
        s.setPassword(r.getPasswordHash());
        s.setTemporaryPassword(null);
        s.setIsVerified(true);
        s.setIsArchived(false);
        s.setMustChangePassword(false); // siya mismo ang pumili ng password
        s.setPrivacyAckAt(r.getPrivacyAckAt());
        s.setPrivacyAckVersion(r.getPrivacyAckVersion());
        s.setProfileRequired(true);
        students.save(s);

        r.setStatus(StudentRegistration.VERIFIED);
        r.setStudentId(s.getId());
        r.setDecidedAt(LocalDateTime.now());
        registrations.save(r);

        notifyStudent(s.getId(), "registration_verified", "Your account was verified",
                "Welcome! Please complete your profile to start using the system.");
        return s;
    }

    /** Reject ng hindi pa verified na email o ng naghihintay ng approval */
    public void reject(StudentRegistration r, String reason) {
        if (!StudentRegistration.PENDING.equals(r.getStatus())
                && !StudentRegistration.EMAIL_PENDING.equals(r.getStatus())) {
            throw ActionException.conflict("This registration was already handled.");
        }
        String why = cleanReason(reason);
        r.setStatus(StudentRegistration.REJECTED);
        r.setRejectReason(why);
        r.setDecidedAt(LocalDateTime.now());
        registrations.save(r);
        emailTokens.closeAll(EmailToken.REGISTRATION, r.getId(), EmailToken.VERIFY_REGISTRATION);
        // Walang Student na mapapadalhan ng abiso; makikita niya ang dahilan kapag nag-login siya.
        // Email lang kapag na-verify na niya ang address (hindi kailanman sa hindi pa napatunayang email).
        if (r.getEmailVerifiedAt() != null) {
            mail.send(r.getEmail(), MailTemplates.registrationNotApproved(collegeOf(r.getCoordinator()),
                    r.getFirstname(), mail.webUrl("/login")));
        }
    }

    /**
     * Inaalis ang access ng account na nagawa na (hal. awtomatikong na-verify pero hindi pala estudyante ng klase).
     * Naka-archive ang student (hindi makaka-login, at hindi na gagana ang mga JWT niya), at sinasabihan siya sa email.
     */
    public void revoke(StudentRegistration r, Student s, String reason) {
        if (!StudentRegistration.VERIFIED.equals(r.getStatus()) || s == null) {
            throw ActionException.conflict("Only created accounts can be revoked.");
        }
        String why = cleanReason(reason);
        s.setIsArchived(true);
        s.setAccessRevokedAt(LocalDateTime.now());
        s.setAccessRevokeReason(why);
        students.save(s);

        r.setStatus(StudentRegistration.REVOKED);
        r.setRejectReason(why);
        r.setDecidedAt(LocalDateTime.now());
        registrations.save(r);

        emailTokens.closeAll(EmailToken.STUDENT, s.getId(), EmailToken.PASSWORD_RESET);
        mail.send(s.getEmail(), MailTemplates.accessRevoked(collegeOf(r.getCoordinator()), s.getFirstname()));
    }

    private static String cleanReason(String reason) {
        String why = reason == null ? "" : reason.trim().replaceAll("\\s+", " ");
        if (why.length() > 300) throw ActionException.bad("Reason is too long (max 300 characters).");
        return why.isEmpty() ? null : why;
    }

    /** Pangalan ng college ng coordinator para sa email; null = default */
    public static String collegeOf(Coordinator c) {
        try {
            if (c == null || c.getProgram() == null || c.getProgram().getCollege() == null) return null;
            return c.getProgram().getCollege().getName();
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Mensahe sa login: "Please verify your email first..."; ginagamit din ng frontend para ipakita ang Resend */
    public static final String VERIFY_EMAIL_FIRST =
            "Please verify your email first. Open the link we sent to your email to finish registering.";

    /** Ang mensaheng ipinapakita sa login kapag hindi pa verified o na-reject */
    public static String loginMessage(StudentRegistration r) {
        if (StudentRegistration.EMAIL_PENDING.equals(r.getStatus())) {
            return VERIFY_EMAIL_FIRST;
        }
        if (StudentRegistration.PENDING.equals(r.getStatus())) {
            return "Your registration is waiting for your coordinator to verify your account. "
                    + "Please check again later.";
        }
        String reason = r.getRejectReason() == null ? "" : " Reason: " + r.getRejectReason();
        return "Your registration was not approved." + reason
                + " You can register again with the correct details, or contact your coordinator.";
    }

    private void notifyStudent(Long studentId, String type, String title, String message) {
        try {
            studentNotifications.save(new StudentNotification(studentId, type, title, message));
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(RegistrationService.class)
                    .warn("Couldn't save the student notification", e);
        }
    }
}
