package com.iodev.practicum.service;

import com.iodev.practicum.model.Coordinator;
import com.iodev.practicum.model.DocumentRequirement;
import com.iodev.practicum.model.Evaluation;
import com.iodev.practicum.model.EvaluationCriteria;
import com.iodev.practicum.model.Semester;
import com.iodev.practicum.repository.CoordinatorRepository;
import com.iodev.practicum.repository.DocumentRequirementRepository;
import com.iodev.practicum.repository.EvaluationCriteriaRepository;
import com.iodev.practicum.repository.EvaluationRepository;
import com.iodev.practicum.repository.SemesterRepository;
import com.iodev.practicum.util.EvaluationAccess;
import com.iodev.practicum.util.EvaluationForms;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tinitiyak na may Midterm at Final Evaluation ang bawat coordinator sa bawat semester.
 * Ligtas itong ulitin: ang kulang lang ang idinadagdag, kaya hindi ito nagdodoble.
 */
@Service
public class BuiltInRequirementService {

    @Autowired private DocumentRequirementRepository requirementRepository;
    @Autowired private CoordinatorRepository coordinatorRepository;
    @Autowired private SemesterRepository semesterRepository;
    @Autowired private EvaluationRepository evaluationRepository;
    @Autowired private EvaluationCriteriaRepository criteriaRepository;

    /** Para sa lahat ng umiiral na coordinator at semester (tinatawag sa pag-start ng app) */
    @Transactional
    public int ensureAll() {
        return ensure(coordinatorRepository.findAll(), semesterRepository.findAll());
    }

    /** Para sa bagong semester */
    @Transactional
    public int ensureFor(Semester semester) {
        return ensure(coordinatorRepository.findAll(), List.of(semester));
    }

    /** Para sa bagong coordinator */
    @Transactional
    public int ensureFor(Coordinator coordinator) {
        return ensure(List.of(coordinator), semesterRepository.findAll());
    }

    private int ensure(Collection<Coordinator> coordinators, Collection<Semester> semesters) {
        if (coordinators.isEmpty() || semesters.isEmpty()) return 0;

        Set<String> existing = new HashSet<>();
        for (Object[] row : requirementRepository.findBuiltInKeys()) {
            existing.add(row[0] + "-" + row[1] + "-" + row[2]);
        }

        // Aktibong requirement na ginawa ng coordinator na may parehong pamagat: ito ang gagawing built-in
        List<String> titles = EvaluationAccess.KEYS.stream().map(k -> EvaluationAccess.titleOf(k).toLowerCase()).toList();
        Map<String, DocumentRequirement> sameTitle = new HashMap<>();
        for (DocumentRequirement r : requirementRepository.findAdoptable(EvaluationAccess.TYPE, titles)) {
            sameTitle.putIfAbsent(r.getCoordinator().getId() + "-" + r.getSemester().getId() + "-"
                    + r.getTitle().trim().toLowerCase(), r);
        }

        int changed = 0;
        for (Coordinator c : coordinators) {
            for (Semester s : semesters) {
                for (String key : EvaluationAccess.KEYS) {
                    if (existing.contains(c.getId() + "-" + s.getId() + "-" + key)) continue;

                    String title = EvaluationAccess.titleOf(key);
                    DocumentRequirement r = sameTitle.get(c.getId() + "-" + s.getId() + "-" + title.toLowerCase());
                    if (r == null) {
                        r = new DocumentRequirement();
                        r.setCoordinator(c);
                        r.setSemester(s);
                        r.setType(EvaluationAccess.TYPE);
                        r.setIsArchived(false);
                    }
                    r.setTitle(title);
                    r.setSystemKey(key);
                    requirementRepository.save(r);
                    changed++;
                }
            }
        }
        return changed + seedForms();
    }

    /** Ang Evaluation at mga criteria ng bawat built-in na wala pa nito, kasama ang mga dati na */
    private int seedForms() {
        List<DocumentRequirement> missing = requirementRepository.findBuiltInsWithoutForm();
        List<EvaluationCriteria> criteria = new ArrayList<>();
        for (DocumentRequirement r : missing) {
            String key = r.getSystemKey();
            Evaluation e = new Evaluation();
            e.setCoordinator(r.getCoordinator());
            e.setSemester(r.getSemester());
            e.setRequirement(r);
            e.setEvaluationType(EvaluationForms.evaluationType(key));
            e.setScoreType(EvaluationForms.scoreType(key));
            // Hindi pwedeng walang laman ang column; ang template ay nasa attachments ng requirement
            e.setTemplate("");
            e = evaluationRepository.save(e);

            int order = 0;
            for (EvaluationForms.Criterion item : EvaluationForms.criteria(key)) {
                EvaluationCriteria c = new EvaluationCriteria();
                c.setEvaluation(e);
                c.setCategory(item.category());
                c.setName(item.name());
                c.setWeight(item.weight());
                c.setSortOrder(order++);
                criteria.add(c);
            }
        }
        criteriaRepository.saveAll(criteria);
        return missing.size();
    }
}
