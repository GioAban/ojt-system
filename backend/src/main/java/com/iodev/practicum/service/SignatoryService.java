package com.iodev.practicum.service;

import com.iodev.practicum.model.CoordinatorReportSignatories;
import com.iodev.practicum.repository.CoordinatorReportSignatoriesRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Pirmahan ng mga report ng coordinator (iisa para sa lahat ng report niya). Mula sa Edit mode ng report,
 * dumadaan ito sa "Save changes to database" gaya ng ibang field: ang bawat pangalan o titulo ay isang pagbabago.
 */
@Service
public class SignatoryService {

    public static final List<String> ROLES = List.of("prepared", "programHead", "dean", "chair");
    private static final int MAX_CHARS = 5_000;
    private static final Map<String, String> ROLE_LABEL = Map.of(
            "prepared", "Prepared by", "programHead", "Noted, program head",
            "dean", "Noted, dean", "chair", "Certified true and correct");

    private final JsonMapper json = JsonMapper.builder().build();

    @Autowired private CoordinatorReportSignatoriesRepository repository;

    /** "prepared.name" -> "Prepared by, name" */
    public static String labelOf(String field) {
        String[] parts = field == null ? new String[0] : field.split("\\.");
        if (parts.length != 2) return "Signatory";
        return ROLE_LABEL.getOrDefault(parts[0], "Signatory") + ", " + parts[1];
    }

    /**
     * @param field        "&lt;role&gt;.name" o "&lt;role&gt;.title"
     * @param defaultValue ang default ng system para sa field na ito (kapag walang binago ang coordinator)
     */
    public PreparedChange check(Long coordinatorId, String field, String raw, String defaultValue) {
        String[] parts = field == null ? new String[0] : field.split("\\.");
        if (parts.length != 2 || !ROLES.contains(parts[0]) || !(parts[1].equals("name") || parts[1].equals("title"))) {
            throw ActionException.bad("That signatory field can't be changed.");
        }
        String role = parts[0];
        String key = parts[1];
        String value = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (value.length() > 255) throw ActionException.bad("The signatory " + key + " is too long (max 255 characters).");

        Map<String, Map<String, String>> saved = load(coordinatorId);
        Map<String, String> current = saved.get(role);
        String old = current != null && current.containsKey(key) ? current.get(key) : (defaultValue == null ? "" : defaultValue);
        if (old.equals(value)) return new PreparedChange(labelOf(field), old, value, 0, null);

        return new PreparedChange(labelOf(field), old, value, 0, () -> {
            // Kinukuha ulit para maipon ang ilang pagbabago sa iisang pag-save
            Map<String, Map<String, String>> latest = load(coordinatorId);
            latest.computeIfAbsent(role, k -> new LinkedHashMap<>()).put(key, value);
            String content = json.writeValueAsString(latest);
            if (content.length() > MAX_CHARS) throw ActionException.bad("The names are too long.");
            CoordinatorReportSignatories s = repository.findByCoordinatorId(coordinatorId).orElse(null);
            if (s == null) {
                s = new CoordinatorReportSignatories();
                s.setCoordinatorId(coordinatorId);
            }
            s.setContent(content);
            repository.save(s);
        });
    }

    private Map<String, Map<String, String>> load(Long coordinatorId) {
        String raw = repository.findByCoordinatorId(coordinatorId).map(CoordinatorReportSignatories::getContent).orElse(null);
        if (raw == null || raw.isBlank()) return new LinkedHashMap<>();
        try {
            Map<String, Map<String, String>> parsed = json.readValue(raw, new TypeReference<>() {});
            return parsed == null ? new LinkedHashMap<>() : new LinkedHashMap<>(parsed);
        } catch (JacksonException e) {
            return new LinkedHashMap<>();
        }
    }
}
