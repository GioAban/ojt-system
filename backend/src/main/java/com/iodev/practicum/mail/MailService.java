package com.iodev.practicum.mail;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Locale;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Nagpapadala ng email sa background: hindi kailanman hinihintay ng request ang mail provider.
 * Kapag may database transaction, pagkatapos lang ng commit ipinapadala (walang email kapag na-rollback).
 * Ang pagkabigo ay nila-log (naka-mask ang address); walang ibinabato pabalik sa request.
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    @Value("${app.mail.provider:log}") private String providerName;
    @Value("${app.mail.from:}") private String from;
    @Value("${app.mail.from-name:OJT System}") private String fromName;
    @Value("${app.mail.reply-to:}") private String replyTo;
    @Value("${app.mail.ses-region:ap-southeast-1}") private String sesRegion;
    @Value("${app.mail.ses-configuration-set:}") private String sesConfigurationSet;
    @Value("${app.web-url:http://localhost:5173}") private String webUrl;

    @Autowired private MailTemplates templates;

    private MailProvider provider;
    private String fromHeader;
    private ThreadPoolExecutor executor;

    @PostConstruct
    void init() {
        String wanted = providerName == null ? "" : providerName.trim().toLowerCase(Locale.ROOT);
        boolean hasFrom = from != null && !from.isBlank();
        if (wanted.equals("ses") && hasFrom) {
            provider = new SesMailProvider(sesRegion, sesConfigurationSet);
        } else {
            if (wanted.equals("ses")) {
                log.warn("MAIL_PROVIDER=ses but MAIL_FROM is empty. Emails will only be printed to the console.");
            } else if (!wanted.isEmpty() && !wanted.equals("log")) {
                log.warn("Unknown MAIL_PROVIDER '{}'. Emails will only be printed to the console.", providerName);
            }
            provider = new LogMailProvider();
        }
        fromHeader = fromHeader(fromName, hasFrom ? from.trim() : "no-reply@localhost");

        AtomicInteger n = new AtomicInteger();
        executor = new ThreadPoolExecutor(1, 2, 60, TimeUnit.SECONDS, new ArrayBlockingQueue<>(200), r -> {
            Thread t = new Thread(r, "mail-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        }, new ThreadPoolExecutor.AbortPolicy());
        log.info("Email provider: {}{}", provider.name(), hasFrom ? " (from " + from.trim() + ")" : "");
    }

    @PreDestroy
    void shutdown() throws InterruptedException {
        executor.shutdown();
        executor.awaitTermination(20, TimeUnit.SECONDS);
    }

    /** Address ng web app para sa mga link, walang "/" sa dulo */
    public String webUrl(String path) {
        String base = webUrl == null || webUrl.isBlank() ? "http://localhost:5173" : webUrl.trim();
        while (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        return base + path;
    }

    /** Ipinapila ang email. Walang ginagawa kapag walang address. */
    public void send(String to, MailContent content) {
        if (to == null || to.isBlank()) return;
        // Nire-render dito (sa thread ng request) para walang lazy na datos na binabasa sa background
        MailMessage message = templates.render(to.trim(), content);
        Runnable job = () -> deliver(message);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    submit(job, message);
                }
            });
        } else {
            submit(job, message);
        }
    }

    private void submit(Runnable job, MailMessage m) {
        try {
            executor.execute(job);
        } catch (RejectedExecutionException e) {
            log.warn("Email queue is full; dropped '{}' to {}", m.subject(), mask(m.to()));
        }
    }

    private void deliver(MailMessage m) {
        try {
            String id = provider.send(m, fromHeader, replyTo);
            if (id != null) log.info("Email sent: '{}' to {} (message id {})", m.subject(), mask(m.to()), id);
        } catch (Exception e) {
            log.warn("Couldn't send '{}' to {}: {}", m.subject(), mask(m.to()), e.toString());
        }
    }

    /** j***@gmail.com */
    public static String mask(String email) {
        if (email == null) return "";
        int at = email.indexOf('@');
        if (at <= 0) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }

    /** "Pangalan" <address>; naka-encode kapag may hindi ASCII na titik */
    static String fromHeader(String name, String address) {
        String n = name == null ? "" : name.trim().replaceAll("[\\r\\n]", " ");
        if (n.isEmpty()) return address;
        boolean ascii = StandardCharsets.US_ASCII.newEncoder().canEncode(n);
        String shown = ascii
                ? "\"" + n.replace("\\", "\\\\").replace("\"", "\\\"") + "\""
                : "=?UTF-8?B?" + Base64.getEncoder().encodeToString(n.getBytes(StandardCharsets.UTF_8)) + "?=";
        return shown + " <" + address + ">";
    }
}
