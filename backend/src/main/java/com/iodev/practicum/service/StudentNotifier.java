package com.iodev.practicum.service;

import com.iodev.practicum.model.DocumentRequirement;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/** Abiso para sa mga student na sabay-sabay ginagawa, sa isang INSERT lang. */
@Service
public class StudentNotifier {

    private static final DateTimeFormatter DUE = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH);

    @Autowired private JdbcTemplate jdbc;

    /**
     * Hiwalay na transaction: tinatawag ito pagkatapos ma-commit ang pagbukas, kaya
     * ang pagpalya rito ay hindi makakaapekto sa nabuksan na.
     * Tuwirang INSERT dahil ang saveAll ay isa-isang INSERT kapag IDENTITY ang id.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void evaluationOpened(DocumentRequirement requirement, Collection<Long> studentIds) {
        if (studentIds.isEmpty()) return;

        String type = "evaluation_open:requirement:" + requirement.getId();
        String title = requirement.getTitle() + " is now open";
        String message = "You can now submit it."
                + (requirement.getDueDate() == null ? ""
                        : " Due " + requirement.getDueDate().toLocalDateTime().format(DUE) + ".");
        Timestamp now = Timestamp.valueOf(LocalDateTime.now());

        List<Object> args = new ArrayList<>(studentIds.size() * 5);
        for (Long id : studentIds) {
            args.add(id);
            args.add(type);
            args.add(title);
            args.add(message);
            args.add(now);
        }
        String rows = String.join(",", java.util.Collections.nCopies(studentIds.size(), "(?,?,?,?,?)"));
        jdbc.update("insert into student_notifications (student_id, type, title, message, created_at) values " + rows,
                args.toArray());
    }
}
