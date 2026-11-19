package com.iodev.practicum.service;

import com.iodev.practicum.mail.MailService;
import com.iodev.practicum.mail.MailTemplates;
import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.User;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.StudentManagementRepository;
import com.iodev.practicum.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Locale;

/**
 * Forgot password para sa mga student at coordinator/staff (users). Hindi kasama ang director.
 * Laging parehong sagot ang "forgot" (walang malalaman kung may account ang email), isang beses lang magagamit
 * ang link at 1 oras lang. Pagkatapos ma-reset: hindi na gagana ang mga lumang login (password_changed_at)
 * at may abiso sa email.
 */
@Service
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    public static final Duration LINK_VALID_FOR = Duration.ofHours(1);

    @Autowired private UserRepository users;
    @Autowired private StudentManagementRepository students;
    @Autowired private CoordinatorRepository coordinators;
    @Autowired private EmailTokenService tokens;
    @Autowired private MailService mail;
    @Autowired private PasswordEncoder passwordEncoder;

    /** Ang account na may-ari ng email (user muna, kagaya ng login), o null */
    private record Account(String type, Long id, String email, String firstName, String college) {}

    @Transactional
    public void forgot(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim();
        if (email.isEmpty() || email.length() > 255 || !email.contains("@")) return;

        Account a = find(email);
        if (a == null) return;
        if (!tokens.mayIssue(EmailToken.PASSWORD_RESET, a.type(), a.id(), a.email())) {
            log.info("Password reset email skipped (limit reached) for {}", MailService.mask(a.email()));
            return;
        }
        String raw = tokens.issue(EmailToken.PASSWORD_RESET, a.type(), a.id(), a.email(), LINK_VALID_FOR);
        mail.send(a.email(), MailTemplates.passwordReset(a.college(), a.firstName(),
                mail.webUrl("/reset-password?token=" + raw)));
    }

    /** valid | expired | used | invalid (hindi ginagamit ang token) */
    @Transactional(readOnly = true)
    public String check(String raw) {
        EmailTokenService.Lookup l = tokens.find(raw, EmailToken.PASSWORD_RESET);
        if (l.state() == EmailTokenService.State.VALID && load(l.token()) == null) return "invalid";
        return l.state().name().toLowerCase(Locale.ROOT);
    }

    /** Ibinabato ang ActionException (400/410) kapag hindi puwede */
    @Transactional
    public void reset(String raw, String password, String confirm) {
        EmailTokenService.Lookup l = tokens.find(raw, EmailToken.PASSWORD_RESET);
        switch (l.state()) {
            case EXPIRED -> throw new ActionException(410, "This link has expired. Request a new one.");
            case USED -> throw new ActionException(410, "This link was already used. Request a new one if you need to.");
            case INVALID -> throw new ActionException(410, "This link isn't valid. Request a new one.");
            default -> { }
        }
        Object account = load(l.token());
        if (account == null) throw new ActionException(410, "This link isn't valid. Request a new one.");

        String studentNumber = account instanceof Student s ? s.getStudentNumber() : null;
        String problem = RegistrationService.passwordProblemFor(password, confirm, studentNumber);
        if (problem != null) throw ActionException.bad(problem);

        LocalDateTime now = LocalDateTime.now();
        String hash = passwordEncoder.encode(password);
        String to;
        String first;
        String college;
        String contact;
        if (account instanceof Student s) {
            s.setPassword(hash);
            s.setTemporaryPassword(null);
            s.setMustChangePassword(false);
            s.setPasswordChangedAt(now);
            students.save(s);
            to = s.getEmail();
            first = s.getFirstname();
            college = RegistrationService.collegeOf(s.getCoordinator());
            contact = "your coordinator";
        } else {
            User u = (User) account;
            u.setPassword(hash);
            u.setPasswordChangedAt(now);
            users.save(u);
            to = u.getEmail();
            first = firstWord(u.getFullname());
            college = collegeOfUser(u);
            contact = "the OJT director";
        }
        tokens.markUsed(l.token());
        tokens.closeAll(l.token().getSubjectType(), l.token().getSubjectId(), EmailToken.PASSWORD_RESET);
        mail.send(to, MailTemplates.passwordChanged(college, first, mail.webUrl("/login"), contact));
    }

    // ---------------------------------------------------------------------

    private Account find(String email) {
        User u = users.findByEmail(email).orElse(null);
        if (u == null && !email.equals(email.toLowerCase(Locale.ROOT))) {
            u = users.findByEmail(email.toLowerCase(Locale.ROOT)).orElse(null);
        }
        if (u != null) {
            if (Boolean.TRUE.equals(u.getIsArchived())) return null;
            return new Account(EmailToken.USER, u.getId(), u.getEmail(), firstWord(u.getFullname()), collegeOfUser(u));
        }
        Student s = students.findByEmail(email).stream()
                .filter(x -> !Boolean.TRUE.equals(x.getIsArchived()))
                .findFirst().orElse(null);
        if (s == null || s.getEmail() == null || s.getEmail().isBlank()) return null;
        return new Account(EmailToken.STUDENT, s.getId(), s.getEmail(), s.getFirstname(),
                RegistrationService.collegeOf(s.getCoordinator()));
    }

    /** Ang Student o User ng token; null kapag wala na o naka-archive */
    private Object load(EmailToken t) {
        if (EmailToken.STUDENT.equals(t.getSubjectType())) {
            Student s = students.findById(t.getSubjectId()).orElse(null);
            return s == null || Boolean.TRUE.equals(s.getIsArchived()) ? null : s;
        }
        if (EmailToken.USER.equals(t.getSubjectType())) {
            User u = users.findById(t.getSubjectId()).orElse(null);
            return u == null || Boolean.TRUE.equals(u.getIsArchived()) ? null : u;
        }
        return null;
    }

    private String collegeOfUser(User u) {
        Coordinator c = coordinators.findByUserId(u.getId()).orElse(null);
        return RegistrationService.collegeOf(c);
    }

    private static String firstWord(String fullname) {
        if (fullname == null) return null;
        String t = fullname.trim();
        int sp = t.indexOf(' ');
        return sp > 0 ? t.substring(0, sp) : t;
    }
}
