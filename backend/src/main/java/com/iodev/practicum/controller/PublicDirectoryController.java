package com.iodev.practicum.controller;

import com.iodev.practicum.model.Coordinator;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * PUBLIC: listahan ng mga OJT coordinator at staff kada program para sa login page.
 * Idagdag ang /api/public/** sa permitAll ng SecurityConfig. Pangalan, titulo at tungkulin lang;
 * walang email o numero para hindi ma-spam.
 */
@RestController
@RequestMapping("/api/public")
public class PublicDirectoryController {

    public record Person(String name, String titles, String role) {}

    public record ProgramEntry(String college, String collegeAbbreviation, String program,
                               String programAbbreviation, String programHead, List<Person> people) {}

    @PersistenceContext private EntityManager em;

    @GetMapping("/directory")
    @Transactional(readOnly = true)
    public ResponseEntity<?> directory() {
        List<Coordinator> all = em.createQuery(
                "select c from Coordinator c join fetch c.user left join fetch c.program p left join fetch p.college",
                Coordinator.class).getResultList();

        Map<Long, ProgramEntry> byProgram = new LinkedHashMap<>();
        Map<Long, List<Person>> people = new LinkedHashMap<>();

        for (Coordinator c : all) {
            Object user = c.getUser();
            Object program = c.getProgram();
            if (user == null || program == null || archived(user) || archived(program)) continue;

            Long programId = (Long) call(program, "getId");
            Object college = call(program, "getCollege");
            if (college != null && archived(college)) continue;

            byProgram.computeIfAbsent(programId, id -> new ProgramEntry(
                    str(college, "getName"), str(college, "getAbbreviation"),
                    str(program, "getName"), str(program, "getAbbreviation"),
                    str(program, "getProgramHead"), new ArrayList<>()));

            String type = str(c, "getType").toUpperCase();
            String role = type.contains("ADMIN") ? "OJT Coordinator" : "Staff";
            people.computeIfAbsent(programId, id -> new ArrayList<>())
                    .add(new Person(str(user, "getFullname"), str(c, "getProfessionalTitles"), role));
        }

        List<ProgramEntry> out = new ArrayList<>();
        for (Map.Entry<Long, ProgramEntry> e : byProgram.entrySet()) {
            ProgramEntry p = e.getValue();
            List<Person> list = new ArrayList<>(people.get(e.getKey()));
            // Coordinator muna, pagkatapos staff; alpabetiko sa loob ng grupo
            list.sort(Comparator.comparing((Person x) -> x.role().equals("OJT Coordinator") ? 0 : 1)
                    .thenComparing(x -> x.name().toLowerCase()));
            out.add(new ProgramEntry(p.college(), p.collegeAbbreviation(), p.program(), p.programAbbreviation(),
                    p.programHead(), list));
        }
        out.sort(Comparator.comparing((ProgramEntry x) -> x.program().toLowerCase()));
        return ResponseEntity.ok(out);
    }

    // Reflection para hindi umasa sa eksaktong getter ng bawat entity; palitan ng diretsong getter kung gusto

    private static Object call(Object target, String getter) {
        if (target == null) return null;
        try {
            return target.getClass().getMethod(getter).invoke(target);
        } catch (ReflectiveOperationException e) {
            return null;
        }
    }

    private static String str(Object target, String getter) {
        Object v = call(target, getter);
        return v == null ? "" : v.toString().trim();
    }

    private static boolean archived(Object target) {
        for (String g : new String[] {"getIsArchived", "isArchived", "getArchived"}) {
            Object v = call(target, g);
            if (v instanceof Boolean b) return b;
        }
        return false;
    }
}
