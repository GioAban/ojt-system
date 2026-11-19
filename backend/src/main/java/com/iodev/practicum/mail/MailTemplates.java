package com.iodev.practicum.mail;

import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Ang mga email ng system (maikli, malinaw na English, isang button, walang tracking) at ang pag-render nila
 * sa text at HTML gamit ang resources/mail/layout.*. Escaped sa HTML ang lahat ng value.
 */
@Component
public class MailTemplates {

    public static final String DEFAULT_COLLEGE = "Urdaneta City University";

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");
    private static final String FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

    private final String htmlLayout = load("mail/layout.html");
    private final String textLayout = load("mail/layout.txt");

    // ---------------------------------------------------------------------
    // Ang mga email
    // ---------------------------------------------------------------------

    public static MailContent verifyEmail(String college, String firstName, String url) {
        String c = college(college);
        return new MailContent(c, "Verify your email for the OJT System", "Verify your email",
                List.of(greeting(firstName),
                        "Please confirm your email to finish registering for the " + c + " OJT System."),
                "Verify my email", url,
                "This link expires in 24 hours and works once. If you didn't register, you can ignore this email.");
    }

    public static MailContent accountReady(String college, String firstName, String loginUrl) {
        String c = college(college);
        return new MailContent(c, "Your OJT System account is ready", "Your account is ready",
                List.of(greeting(firstName),
                        "Your coordinator approved your registration. You can now log in to the " + c + " OJT System."),
                "Log in", loginUrl,
                "Use the email and password you registered with.");
    }

    public static MailContent registrationNotApproved(String college, String firstName, String loginUrl) {
        String c = college(college);
        return new MailContent(c, "Your OJT System registration wasn't approved", "Registration not approved",
                List.of(greeting(firstName),
                        "Your coordinator didn't approve your registration for the " + c + " OJT System.",
                        "To see the reason, try logging in with the email and password you registered with. "
                                + "You can register again with the correct details, or contact your coordinator."),
                "Open the OJT System", loginUrl,
                "If you didn't register, you can ignore this email.");
    }

    public static MailContent accessRevoked(String college, String firstName) {
        String c = college(college);
        return new MailContent(c, "Your OJT System access was removed", "Your access was removed",
                List.of(greeting(firstName),
                        "Your coordinator removed your access to the " + c + " OJT System. You can't log in anymore.",
                        "If you think this is a mistake, please contact your coordinator."),
                null, null,
                "You're receiving this because an account was created with this email.");
    }

    public static MailContent passwordReset(String college, String firstName, String url) {
        String c = college(college);
        return new MailContent(c, "Reset your OJT System password", "Reset your password",
                List.of(greeting(firstName),
                        "We got a request to reset your password. Tap the button to choose a new one."),
                "Choose a new password", url,
                "This link expires in 1 hour and works once. If you didn't ask for this, ignore this email; "
                        + "your password stays the same.");
    }

    public static MailContent passwordChanged(String college, String firstName, String loginUrl, String whoToContact) {
        String c = college(college);
        return new MailContent(c, "Your OJT System password was changed", "Your password was changed",
                List.of(greeting(firstName),
                        "The password for your " + c + " OJT System account was just changed, "
                                + "and you were logged out on your other devices.",
                        "If this wasn't you, contact " + whoToContact + " right away."),
                "Log in", loginUrl,
                "You're receiving this to keep your account safe.");
    }

    private static String greeting(String firstName) {
        String n = firstName == null ? "" : firstName.trim();
        return n.isEmpty() ? "Hi," : "Hi " + n + ",";
    }

    private static String college(String college) {
        return college == null || college.isBlank() ? DEFAULT_COLLEGE : college.trim();
    }

    // ---------------------------------------------------------------------
    // Pag-render
    // ---------------------------------------------------------------------

    public MailMessage render(String to, MailContent c) {
        boolean hasButton = c.url() != null && !c.url().isBlank() && c.buttonLabel() != null;

        StringBuilder htmlBody = new StringBuilder();
        List<String> textParas = new ArrayList<>();
        for (int i = 0; i < c.paragraphs().size(); i++) {
            String p = c.paragraphs().get(i);
            htmlBody.append("<p style=\"margin:").append(i == 0 ? "0" : "12px 0 0").append(";\">")
                    .append(esc(p)).append("</p>");
            textParas.add(p);
        }

        String htmlButton = "";
        String textButton = "";
        if (hasButton) {
            String url = esc(c.url());
            htmlButton = "<tr><td style=\"padding:24px 24px 0;\">"
                    + "<a href=\"" + url + "\" style=\"display:inline-block;background:#18181b;color:#ffffff;"
                    + "text-decoration:none;font-family:" + FONT + ";font-size:15px;font-weight:600;"
                    + "line-height:1.2;padding:14px 22px;border-radius:8px;\">" + esc(c.buttonLabel()) + "</a>"
                    + "</td></tr>"
                    + "<tr><td style=\"padding:16px 24px 0;font-family:" + FONT + ";font-size:12px;line-height:1.5;"
                    + "color:#71717a;word-break:break-all;\">If the button doesn't work, copy this link:<br>"
                    + "<a href=\"" + url + "\" style=\"color:#2563eb;\">" + url + "</a></td></tr>";
            textButton = "\n" + c.buttonLabel() + ":\n" + c.url() + "\n";
        }

        String html = fill(htmlLayout, Map.of(
                "subject", esc(c.subject()),
                "college", esc(c.college()),
                "heading", esc(c.heading()),
                "body", htmlBody.toString(),
                "button", htmlButton,
                "note", esc(c.note() == null ? "" : c.note())));
        String text = fill(textLayout, Map.of(
                "subject", c.subject(),
                "college", c.college(),
                "heading", c.heading(),
                "body", String.join("\n\n", textParas),
                "button", textButton,
                "note", c.note() == null ? "" : c.note()));
        return new MailMessage(to, c.subject(), text, html);
    }

    /** Isang pasada lang, kaya hindi napapalitan ang {{...}} na nasa loob ng mismong value */
    private static String fill(String layout, Map<String, String> values) {
        Matcher m = PLACEHOLDER.matcher(layout);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String v = values.getOrDefault(m.group(1), "");
            m.appendReplacement(out, Matcher.quoteReplacement(v));
        }
        m.appendTail(out);
        return out.toString();
    }

    static String esc(String v) {
        if (v == null) return "";
        StringBuilder out = new StringBuilder(v.length() + 16);
        for (char ch : v.toCharArray()) {
            switch (ch) {
                case '&' -> out.append("&amp;");
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#39;");
                default -> out.append(ch);
            }
        }
        return out.toString();
    }

    private static String load(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Missing email template " + path, e);
        }
    }
}
