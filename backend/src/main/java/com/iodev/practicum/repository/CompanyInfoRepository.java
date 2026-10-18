package com.iodev.practicum.repository;

import com.iodev.practicum.model.Student;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CompanyInfoRepository extends Repository<Student, Long> {

    @Query("select s from Student s join fetch s.department d join fetch d.company c "
            + "where s.coordinator.id = :coordinatorId and s.semester.id = :semesterId "
            + "order by s.lastname, s.firstname")
    List<Student> findPlaced(@Param("coordinatorId") Long coordinatorId,
                             @Param("semesterId") Long semesterId);
}