package com.iodev.practicum.service;

import com.iodev.practicum.model.CoordinatorNotification;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.repository.CoordinatorNotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Gumagawa ng abiso para sa coordinator ng isang student. Hindi ito dapat makasira sa ginagawa ng student. */
@Service
public class CoordinatorNotifier {

    @Autowired private CoordinatorNotificationRepository repository;

    /** Ang pahina ng gawain sa coordinator side; bubuksan nito ang mismong student. */
    public static String workLink(String scope, Long refId, Long studentId) {
        String base = switch (scope) {
            case StudentWorkService.DTR -> "/coordinator/document-requirements/dtr/";
            case StudentWorkService.WEEKLY -> "/coordinator/document-requirements/weekly/";
            default -> "/coordinator/document-requirements/";
        };
        return base + refId + "/submissions?student=" + studentId;
    }

    public void fromStudent(Student student, String type, String title, String message, String link) {
        try {
            if (student == null || student.getCoordinator() == null) return;
            String text = message == null ? null : (message.length() > 300 ? message.substring(0, 300) + "…" : message);
            repository.save(new CoordinatorNotification(student.getCoordinator().getId(), student.getId(),
                    type, title, text, link));
        } catch (RuntimeException e) {
            org.slf4j.LoggerFactory.getLogger(CoordinatorNotifier.class)
                    .warn("Couldn't save the coordinator notification", e);
        }
    }
}
