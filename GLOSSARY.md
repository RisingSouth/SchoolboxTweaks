# Schoolbox UX Tweaks

The words used for the things Carey staff see in Schoolbox, and for what this extension adds to them.

## Language

### Pastoral notes

**Template**:
A teacher's own saved copy of a pastoral note they can apply to any student. Private to that teacher.
_Avoid_: Saved note, preset, snippet

**Native template**:
The note text Schoolbox itself loads when a Sub-type is chosen.
_Avoid_: Default template, Schoolbox template

**Student token**:
A placeholder in a note, such as First name, that Schoolbox swaps for the student's details when the record is saved.
_Avoid_: Merge field, variable

### Timetable

**Class**:
One teaching group, with its own numeric ID (for example 5960). Has a Class List, a Markbook and a Class page.
_Avoid_: Subject, group

**Course**:
The year-level homepage a Class sits under (for example Year 7 Computing Course). Not the same page as a Class page.
_Avoid_: Class

**Class page**:
A Class's own Schoolbox homepage. The "Go to class" button opens it.
_Avoid_: Class home, course page

**Duty**:
A teacher-defined weekly commitment, such as gate or yard duty, tied to a weekday and a period. Repeats every week until deleted.
_Avoid_: Task, supervision

### Assessments

**Due Work**:
The Schoolbox activity type for an assessable item students can submit to. Chosen on the first step of the new-assessment form. A summative assessment is a Due Work whose work type is Summative Assessment Task.
_Avoid_: Assignment, task (Task is a different activity type)

**Autofill assessment setup**:
The button under Title on a new Due Work form. Sets the standard summative settings and highlights what the teacher still has to enter. Never creates the assessment.
_Avoid_: Auto-fill, template

**Feedback Visibility**:
Who can see marks and feedback on an assessment (Staff Only until released). The page's own label for what the school's setup guide calls "Mark Visibility".
_Avoid_: Mark Visibility

**Highlighted field**:
A field on the new Due Work form outlined in red because the teacher has not yet filled it in. Clears once the teacher edits it.
_Avoid_: Required field, error
