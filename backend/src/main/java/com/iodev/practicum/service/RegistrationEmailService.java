package com.iodev.practicum.service;

import com.iodev.practicum.mail.MailService;
import com.iodev.practicum.mail.MailTemplates;
import com.iodev.practicum.model.EmailToken;
import com.iodev.practicum.model.StudentRegistration;
import com.iodev.practicum.repository.EmailTokenRepository;
import com.iodev.practicum.repository.StudentRegistrationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

/**
 * Verification ng email ng nagparehistro: pagpapadala ng link, pagbukas nito (dito awtomatikong nagagawa ang
 * account, o napupunta sa Pending kapag naka-on ang "Also require my approval"), resend, at paglilinis.
 */
@Service
public class RegistrationEmailService {

    private static final Logger log = LoggerFactory.getLogger(RegistrationEmailService.class);

    public static final Duration LINK_VALID_FOR = Duration.ofHours(24);
    /** Binubura ang hindi na-verify na registration pagkalipas nito */
    public static final Duration UNVERIFIED_KEPT_FOR = Duration.ofDays(7);
    private static final Duration TOKENS_KEPT_FOR = Duration.ofDays(30);

    private static final String REGISTRATIONS_TAB = "/coordinator/students?tab=registrations";

    @Autowired private EmailTokenService tokens;
    @Autowired private EmailTokenRepository tokenRepository;
    @Autowired private MailService mail;
    @Autowired private StudentRegistrationRepository registrations;
    @Autowired private RegistrationService registrationService;
    @Autowired private CoordinatorNotifier notifier;

    /**
     * created = nagawa ang account; awaiting_approval = hinihintay ang coordinator; taken = verified ang email pero
     * may kapareho nang Student ID o email (titingnan ng coordinator); already_verified; replaced = may mas bagong link;
     * expired; invalid.
     */
    public record VerifyResult(String result, String firstName, String college) {}

    /**
     * Nagpapadala ng link kapag hindi lampas sa hangganan (cooldown at 5 kada 24 oras kada address at kada
     * registration). Ibinabalik kung naipadala; ang tumatawag ang magpapasya kung ano ang sasabihin.
     */
    public boolean sendVerification(StudentRegistration r) {
        if (r == null || !StudentRegistration.EMAIL_PENDING.equals(r.getStatus())) return false;
        if (!tokens.mayIssue(EmailToken.VERIFY_REGISTRATION, EmailToken.REGISTRATION, r.getId(), r.getEmail())) {
            log.info("Verification email skipped (limit reached) for {}", MailService.mask(r.getEmail()));
            return false;
        }
        String raw = tokens.issue(EmailToken.VERIFY_REGISTRATION, EmailToken.REGISTRATION, r.getId(),
                r.getEmail(), LINK_VALID_FOR);
        mail.send(r.getEmail(), MailTemplates.verifyEmail(RegistrationService.collegeOf(r.getCoordinator()),
                r.getFirstname(), mail.webUrl("/verify-email?token=" + raw)));
        return true;
    }

    /** Resend gamit ang email. Walang sinasabi kung may registration o wala. */
    @Transactional
    public void resendByEmail(String email) {
        registrations.findUnverifiedByEmail(email).stream().findFirst().ifPresent(this::sendVerification);
    }

    /** Resend mula sa nag-expire na link. Walang sinasabi kung may nangyari. */
    @Transactional
    public void resendByToken(String raw) {
        EmailTokenService.Lookup l = tokens.find(raw, EmailToken.VERIFY_REGISTRATION);
        if (l.token() == null) return;
        registrations.findById(l.token().getSubjectId()).ifPresent(this::sendVerification);
    }

    @Transactional
    public VerifyResult verify(String raw) {
        EmailTokenService.Lookup l = tokens.find(raw, EmailToken.VERIFY_REGISTRATION);
        if (l.state() == EmailTokenService.State.INVALID) return result("invalid", null);

        StudentRegistration r = registrations.findForUpdate(l.token().getSubjectId()).orElse(null);
        if (r == null) return result("invalid", null); // nabura na (hal. lampas 7 araw)

        boolean waiting = StudentRegistration.EMAIL_PENDING.equals(r.getStatus());
        if (l.state() == EmailTokenService.State.EXPIRED && waiting) return result("expired", r);
        if (l.state() != EmailTokenService.State.VALID || !waiting) {
            if (l.state() == EmailTokenService.State.VALID) tokens.markUsed(l.token());
            return afterTheFact(r);
        }

        tokens.markUsed(l.token());
        r.setEmailVerifiedAt(LocalDateTime.now());
        String name = r.getLastname() + ", " + r.getFirstname();
        Long coordinatorId = r.getCoordinator().getId();

        if (r.getLink() != null && r.getLink().isRequireApproval()) {
            r.setStatus(StudentRegistration.PENDING);
            registrations.save(r);
            notifier.toCoordinator(coordinatorId, "registration", "Waiting for your approval: " + name,
                    r.getStudentNumber() + " verified their email and is waiting for you to approve their account.",
                    REGISTRATIONS_TAB);
            return result("awaiting_approval", r);
        }

        try {
            registrationService.createAccount(r);
        } catch (ActionException e) {
            // Ang unang nag-verify ang nananalo; ito ay titingnan ng coordinator (ayusin o i-reject)
            r.setStatus(StudentRegistration.PENDING);
            registrations.save(r);
            notifier.toCoordinator(coordinatorId, "registration", "Check this registration: " + name,
                    r.getStudentNumber() + " verified their email, but the Student ID or email is already used. "
                            + "Fix it or reject the registration.", REGISTRATIONS_TAB);
            return result("taken", r);
        }
        notifier.quietToCoordinator(coordinatorId, "registration", "New student registered: " + name,
                r.getStudentNumber() + " verified their email and their account was created.", REGISTRATIONS_TAB);
        return result("created", r);
    }

    /** Ang sagot kapag nagamit na ang link o tapos na ang registration */
    private VerifyResult afterTheFact(StudentRegistration r) {
        return switch (r.getStatus()) {
            case StudentRegistration.VERIFIED -> result("already_verified", r);
            case StudentRegistration.PENDING -> result("awaiting_approval", r);
            case StudentRegistration.EMAIL_PENDING -> result("replaced", r);
            default -> result("invalid", null);
        };
    }

    private static VerifyResult result(String result, StudentRegistration r) {
        if (r == null) return new VerifyResult(result, null, null);
        String college = RegistrationService.collegeOf(r.getCoordinator());
        return new VerifyResult(result, r.getFirstname(), college == null ? MailTemplates.DEFAULT_COLLEGE : college);
    }

    /** Bawat oras: binubura ang hindi na-verify na lampas 7 araw, at ang lumang email token (lampas 30 araw) */
    @Scheduled(initialDelay = 5 * 60_000, fixedDelay = 60 * 60_000)
    @Transactional
    public void cleanup() {
        LocalDateTime now = LocalDateTime.now();
        int regs = registrations.deleteUnverifiedBefore(now.minus(UNVERIFIED_KEPT_FOR));
        int old = tokenRepository.deleteCreatedBefore(now.minus(TOKENS_KEPT_FOR));
        if (regs > 0 || old > 0) {
            log.info("Cleanup: removed {} unverified registration(s) and {} old email link(s)", regs, old);
        }
    }
}
