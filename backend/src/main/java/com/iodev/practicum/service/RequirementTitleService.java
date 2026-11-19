package com.iodev.practicum.service;

import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.util.EvaluationAccess;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Pamagat ng requirement: parehong tuntunin para sa Requirements page at sa pagpapalit ng pamagat mula sa report.
 */
@Service
public class RequirementTitleService {

    @Autowired private DocumentRequirementRepository requirementRepository;

    /** Kailangan, hanggang 255, at hindi napapalitan ang built-in. Ibinabalik ang nilinis na pamagat. */
    public String validateTitle(DocumentRequirement r, String raw) {
        String title = clean(raw);
        if (title.isEmpty()) throw ActionException.bad("Title is required.");
        if (title.length() > 255) throw ActionException.bad("Title is too long (max 255 characters).");
        if (EvaluationAccess.isBuiltIn(r) && !title.equals(r.getTitle())) {
            throw ActionException.conflict("Built-in requirements can't be renamed.");
        }
        return title;
    }

    /** Walang kaparehong pamagat sa parehong tab (initial, pre o post) ng coordinator sa semester */
    public void checkUnique(DocumentRequirement r, String title) {
        if (!EvaluationAccess.isBuiltIn(r) && requirementRepository.titleExistsExcluding(
                r.getCoordinator().getId(), r.getSemester().getId(), r.getType(), title, r.getId())) {
            throw ActionException.conflict("You already have a requirement with that title in this tab.");
        }
    }

    /** Mula sa report: pamagat lang ang binabago; nananatili ang instructions at due date */
    public PreparedChange checkRename(DocumentRequirement r, String raw) {
        String title = validateTitle(r, raw);
        checkUnique(r, title);
        String old = r.getTitle() == null ? "" : r.getTitle().trim();
        if (old.equals(title)) return new PreparedChange("Requirement title", old, title, 0, null);
        return new PreparedChange("Requirement title", old, title, 0, () -> {
            r.setTitle(title);
            requirementRepository.save(r);
        });
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }
}
