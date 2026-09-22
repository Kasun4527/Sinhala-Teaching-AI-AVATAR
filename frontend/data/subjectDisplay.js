// Some subjects are internally keyed with a trailing grade number (e.g.
// "රසායන විද්‍යාව13") to disambiguate content in the vector DB/curriculum
// data across grades that share a subject name. That's necessary for the
// underlying `subject` string used in API calls and lookups — but showing
// it to the student is redundant, since the grade is already conveyed by
// whichever grade tab/section the card is under. Use this ONLY for the
// rendered label; never for the `subject` value passed to API calls,
// SUBJECT_CFG lookups, or curriculum lookups — those must keep the exact
// original string.
export function displaySubjectName(subject) {
  if (!subject) return subject;
  return subject.replace(/\d+$/, "").trim();
}
