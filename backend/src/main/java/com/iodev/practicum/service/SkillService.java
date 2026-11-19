package com.iodev.practicum.service;

import com.iodev.practicum.model.Company;
import com.iodev.practicum.model.CompanySkill;
import com.iodev.practicum.model.Skill;
import com.iodev.practicum.model.Student;
import com.iodev.practicum.model.StudentSkill;
import com.iodev.practicum.repository.CompanySkillRepository;
import com.iodev.practicum.repository.SkillRepository;
import com.iodev.practicum.repository.StudentSkillRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Iisang catalog ng skills para sa student at company. Ang pagtutugma ay sa normalized key lang (walang AI):
 * maliliit na titik, walang espasyo, tuldok, gitling at underscore, pero nananatili ang + at # (C, C++ at C# ay magkaiba).
 */
@Service
public class SkillService {

    public static final int MAX_LENGTH = 40;
    private static final int MAX_PER_SAVE = 200;

    @Autowired private SkillRepository skills;
    @Autowired private StudentSkillRepository studentLinks;
    @Autowired private CompanySkillRepository companyLinks;

    /** Pangalang ipapakita: trim at iisang espasyo */
    public static String displayName(String raw) {
        return raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
    }

    /** "React JS", "ReactJS", "react.js" -> "reactjs"; "C++" at "C#" ay nananatiling magkaiba */
    public static String normalize(String raw) {
        return displayName(raw).toLowerCase().replaceAll("[\\s._-]+", "");
    }

    /** Sinusuri ang listahan ng skills mula sa form; null kung ayos */
    public static String validate(Collection<String> raw) {
        if (raw == null) return null;
        if (raw.size() > MAX_PER_SAVE) return "That's too many skills at once.";
        for (String r : raw) {
            String name = displayName(r);
            if (name.isEmpty()) continue;
            if (name.length() > MAX_LENGTH) return "\"" + name.substring(0, 20) + "...\" is too long. Keep each skill to " + MAX_LENGTH + " characters.";
            if (normalize(name).isEmpty()) return "\"" + name + "\" isn't a valid skill name.";
        }
        return null;
    }

    /** Kinukuha o ginagawa ang mga skill (walang doble ayon sa key), sa ayos ng pagkakatype */
    public List<Skill> resolve(Collection<String> raw) {
        Map<String, Skill> out = new LinkedHashMap<>();
        if (raw == null) return List.of();
        for (String r : raw) {
            String name = displayName(r);
            String key = normalize(name);
            if (key.isEmpty() || name.length() > MAX_LENGTH || out.containsKey(key)) continue;
            Skill skill = skills.findByNormalizedKey(key).orElse(null);
            if (skill == null) {
                skill = new Skill();
                skill.setName(name);
                skill.setNormalizedKey(key);
                skill = skills.save(skill);
            }
            out.put(key, skill);
        }
        return new ArrayList<>(out.values());
    }

    // ---- Student --------------------------------------------------------

    public List<String> studentSkills(Long studentId) {
        return skills.studentSkills(studentId).stream().map(ss -> ss.getSkill().getName()).toList();
    }

    /** Pinapalitan ang lahat ng skills ng student; ibinabalik ang naka-save */
    public List<String> setStudentSkills(Student student, Collection<String> raw) {
        List<Skill> wanted = resolve(raw);
        Set<Long> wantedIds = new HashSet<>();
        wanted.forEach(s -> wantedIds.add(s.getId()));
        List<StudentSkill> current = skills.studentSkills(student.getId());
        Set<Long> have = new HashSet<>();
        for (StudentSkill ss : current) {
            if (!wantedIds.contains(ss.getSkill().getId())) studentLinks.delete(ss);
            else have.add(ss.getSkill().getId());
        }
        for (Skill s : wanted) {
            if (!have.contains(s.getId())) studentLinks.save(new StudentSkill(student, s));
        }
        return studentSkills(student.getId());
    }

    // ---- Company --------------------------------------------------------

    /** company id -> mga pangalan ng skill */
    public Map<Long, List<String>> companySkills(Collection<Long> companyIds) {
        Map<Long, List<String>> out = new HashMap<>();
        if (companyIds == null || companyIds.isEmpty()) return out;
        for (CompanySkill cs : skills.companySkills(companyIds)) {
            out.computeIfAbsent(cs.getCompany().getId(), k -> new ArrayList<>()).add(cs.getSkill().getName());
        }
        return out;
    }

    public void setCompanySkills(Company company, Collection<String> raw) {
        List<Skill> wanted = resolve(raw);
        Set<Long> wantedIds = new HashSet<>();
        wanted.forEach(s -> wantedIds.add(s.getId()));
        Set<Long> have = new HashSet<>();
        for (CompanySkill cs : skills.companySkills(List.of(company.getId()))) {
            if (!wantedIds.contains(cs.getSkill().getId())) companyLinks.delete(cs);
            else have.add(cs.getSkill().getId());
        }
        for (Skill s : wanted) {
            if (!have.contains(s.getId())) companyLinks.save(new CompanySkill(company, s));
        }
    }

    // ---- Catalog ----------------------------------------------------------

    /** Mga mungkahi habang nagta-type */
    public List<String> search(String q) {
        String key = normalize(q);
        if (key.isEmpty()) return List.of();
        return skills.search(key, PageRequest.of(0, 10)).stream().map(Skill::getName).toList();
    }

    public record SkillUsage(Long id, String name, long students, long companies) {}

    public List<SkillUsage> catalog() {
        Map<Long, Long> students = counts(skills.studentUsage());
        Map<Long, Long> companies = counts(skills.companyUsage());
        return skills.findAll().stream()
                .map(s -> new SkillUsage(s.getId(), s.getName(),
                        students.getOrDefault(s.getId(), 0L), companies.getOrDefault(s.getId(), 0L)))
                .sorted((a, b) -> a.name().compareToIgnoreCase(b.name()))
                .toList();
    }

    /** Bagong pangalan; kapag may ibang skill na sa parehong key, gamitin ang Merge */
    public void rename(Long id, String raw) {
        Skill s = skills.findById(id).orElseThrow(() -> new ActionException(404, "Skill not found."));
        String name = displayName(raw);
        String key = normalize(name);
        if (name.isEmpty() || key.isEmpty()) throw ActionException.bad("Enter the skill name.");
        if (name.length() > MAX_LENGTH) throw ActionException.bad("Keep the skill name to " + MAX_LENGTH + " characters.");
        Skill other = skills.findByNormalizedKey(key).orElse(null);
        if (other != null && !other.getId().equals(id)) {
            throw ActionException.conflict("\"" + other.getName() + "\" already exists. Merge into it instead.");
        }
        s.setName(name);
        s.setNormalizedKey(key);
        skills.save(s);
    }

    /** Inililipat ang lahat ng gumagamit ng source sa target, saka binubura ang source */
    public void merge(Long sourceId, Long targetId) {
        if (sourceId.equals(targetId)) throw ActionException.bad("Choose a different skill to merge into.");
        Skill source = skills.findById(sourceId).orElseThrow(() -> new ActionException(404, "Skill not found."));
        Skill target = skills.findById(targetId).orElseThrow(() -> new ActionException(404, "Skill to merge into wasn't found."));

        Set<Long> studentsWithTarget = new HashSet<>();
        skills.studentLinks(target.getId()).forEach(ss -> studentsWithTarget.add(ss.getStudent().getId()));
        for (StudentSkill ss : skills.studentLinks(source.getId())) {
            if (studentsWithTarget.contains(ss.getStudent().getId())) studentLinks.delete(ss);
            else {
                ss.setSkill(target);
                studentLinks.save(ss);
            }
        }
        Set<Long> companiesWithTarget = new HashSet<>();
        skills.companyLinks(target.getId()).forEach(cs -> companiesWithTarget.add(cs.getCompany().getId()));
        for (CompanySkill cs : skills.companyLinks(source.getId())) {
            if (companiesWithTarget.contains(cs.getCompany().getId())) companyLinks.delete(cs);
            else {
                cs.setSkill(target);
                companyLinks.save(cs);
            }
        }
        studentLinks.flush();
        companyLinks.flush();
        skills.delete(source);
    }

    /** Binubura lang kapag walang gumagamit */
    public void deleteUnused(Long id) {
        Skill s = skills.findById(id).orElseThrow(() -> new ActionException(404, "Skill not found."));
        if (!skills.studentLinks(id).isEmpty() || !skills.companyLinks(id).isEmpty()) {
            throw ActionException.conflict("This skill is still used. Merge it into another skill instead.");
        }
        skills.delete(s);
    }

    private static Map<Long, Long> counts(List<Object[]> rows) {
        Map<Long, Long> out = new HashMap<>();
        for (Object[] r : rows) out.put((Long) r[0], (Long) r[1]);
        return out;
    }
}
