export interface Hadith {
  id: string;
  collection: string;
  hadithNumber: string;
  arabicText: string;
  englishText: string;
  chapterName: string;
  grade: 'Sahih' | 'Hasan' | 'Da\'if' | 'Mawdu\'';
  gradedBy?: string;
}

export const COLLECTIONS = [
  { id: 'bukhari', name: 'Sahih al-Bukhari', size: '7,563 Hadiths' },
  { id: 'muslim', name: 'Sahih Muslim', size: '7,500 Hadiths' },
  { id: 'abudawud', name: 'Sunan Abi Dawud', size: '5,274 Hadiths' },
  { id: 'tirmidhi', name: 'Jami` at-Tirmidhi', size: '4,400 Hadiths' },
  { id: 'nasai', name: 'Sunan an-Nasa\'i', size: '5,700 Hadiths' },
  { id: 'ibnmajah', name: 'Sunan Ibn Majah', size: '4,342 Hadiths' },
];

export const STATIC_HADITHS: Hadith[] = [
  {
    id: 'bukhari:1',
    collection: 'bukhari',
    hadithNumber: '1',
    arabicText: 'إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ‏.',
    englishText: 'I heard Allah\'s Messenger (ﷺ) saying, "The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended. So whoever emigrated for worldly benefits or for a woman to marry, his emigration was for what he emigrated for."',
    chapterName: 'Revelation',
    grade: 'Sahih',
    gradedBy: 'Sahih al-Bukhari'
  },
  {
    id: 'bukhari:13',
    collection: 'bukhari',
    hadithNumber: '13',
    arabicText: 'لاَ يُؤْمِنُ أَحَدُكُمْ حَتَّى يُحِبَّ لأَخِيهِ مَا يُحِبُّ لِنَفْسِهِ‏.',
    englishText: 'The Prophet (ﷺ) said, "None of you will have faith till he wishes for his (Muslim) brother what he likes for himself."',
    chapterName: 'Belief',
    grade: 'Sahih',
    gradedBy: 'Sahih al-Bukhari'
  },
  {
    id: 'bukhari:6018',
    collection: 'bukhari',
    hadithNumber: '6018',
    arabicText: 'مَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلاَ يُؤْذِ جَارَهُ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيُكْرِمْ ضَيْفَهُ، وَمَنْ كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الآخِرِ فَلْيَقُلْ خَيْرًا أَوْ لِيَصْمُتْ‏.',
    englishText: 'The Prophet (ﷺ) said, "Whoever believes in Allah and the Last Day should not hurt his neighbor. And whoever believes in Allah and the Last Day should serve his guest generously. And whoever believes in Allah and the Last Day should speak what is good or keep silent."',
    chapterName: 'Good Manners',
    grade: 'Sahih',
    gradedBy: 'Sahih al-Bukhari'
  },
  {
    id: 'bukhari:6114',
    collection: 'bukhari',
    hadithNumber: '6114',
    arabicText: 'أَنَّ رَجُلاً، قَالَ لِلنَّبِيِّ صلى الله عليه وسلم أَوْصِنِي‏.‏ قَالَ ‏"‏ لاَ تَغْضَبْ ‏"‏‏.‏ فَرَدَّدَ مِرَارًا، قَالَ ‏"‏ لاَ تَغْضَبْ ‏"‏‏.',
    englishText: 'A man said to the Prophet (ﷺ), "Advise me." The Prophet (ﷺ) said, "Do not become angry." The man asked (the same) repeatedly, and the Prophet (ﷺ) said in each case, "Do not become angry."',
    chapterName: 'Good Manners',
    grade: 'Sahih',
    gradedBy: 'Sahih al-Bukhari'
  },
  {
    id: 'muslim:223',
    collection: 'muslim',
    hadithNumber: '223',
    arabicText: 'الطُّهُورُ شَطْرُ الإِيمَانِ، وَالْحَمْدُ لِلَّهِ تَمْلأُ الْمِيزَانَ، وَسُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ تَمْلآنِ - أَوْ تَمْلأُ - مَا بَيْنَ السَّمَوَاتِ وَالأَرْضِ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Cleanliness is half of faith and al-Hamdu Lillah (all praise and gratitude belong to Allah) fills the scale, and Subhan Allah (Glory be to Allah) and al-Hamdu Lillah fill up what is between the heavens and the earth."',
    chapterName: 'Purification',
    grade: 'Sahih',
    gradedBy: 'Sahih Muslim'
  },
  {
    id: 'muslim:2564',
    collection: 'muslim',
    hadithNumber: '2564',
    arabicText: 'إِنَّ اللَّهَ لاَ يَنْظُرُ إِلَى صُوَرِكُمْ وَأَمْوَالِكُمْ وَلَكِنْ يَنْظُرُ إِلَى قُلُوبِكُمْ وَأَعْمَالِكُمْ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Verily, Allah does not look at your appearances or your wealth, but He looks at your hearts and your deeds."',
    chapterName: 'Virtues and Manners',
    grade: 'Sahih',
    gradedBy: 'Sahih Muslim'
  },
  {
    id: 'muslim:55',
    collection: 'muslim',
    hadithNumber: '55',
    arabicText: 'الدِّينُ النَّصِيحَةُ‏. قُلْنَا لِمَنْ؟ قَالَ لِلَّهِ وَلِكِتَابِهِ وَلِرَسُولِهِ وَلأَئِمَّةِ الْمُسْلِمِينَ وَعَامَّتِهِمْ‏.',
    englishText: 'The Prophet (ﷺ) said, "The deen (religion) is sincerity (and well-wishing)." We said, "To whom?" He said, "To Allah, His Book, His Messenger, and to the leaders of the Muslims and their common folk."',
    chapterName: 'Faith',
    grade: 'Sahih',
    gradedBy: 'Sahih Muslim'
  },
  {
    id: 'muslim:49',
    collection: 'muslim',
    hadithNumber: '49',
    arabicText: 'مَنْ رَأَى مِنْكُمْ مُنْكَرًا فَلْيُغَيِّرْهُ بِيَدِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِلِسَانِهِ، فَإِنْ لَمْ يَسْتَطِعْ فَبِقَلْبِهِ، وَذَلِكَ أَضْعَفُ الإِيمَانِ‏.',
    englishText: 'I heard the Messenger of Allah (ﷺ) say, "Whosoever of you sees an evil, let him change it with his hand; and if he is not able to do so, then with his tongue; and if he is not able to do so, then with his heart — and that is the weakest of faith."',
    chapterName: 'Faith',
    grade: 'Sahih',
    gradedBy: 'Sahih Muslim'
  },
  {
    id: 'tirmidhi:1987',
    collection: 'tirmidhi',
    hadithNumber: '1987',
    arabicText: 'اتَّقِ اللَّهِ حَيْثُمَا كُنْتَ، وَأَتْبِعِ السَّيِّئَةَ الْحَسَنَةَ تَمْحُهَا، وَخَالِقِ النَّاسَ بِخُلُقٍ حَسَنٍ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Fear Allah wherever you are, and follow up a bad deed with a good deed which will wipe it out, and behave well towards the people."',
    chapterName: 'Righteousness & Relations',
    grade: 'Hasan',
    gradedBy: 'At-Tirmidhi'
  },
  {
    id: 'abudawud:4811',
    collection: 'abudawud',
    hadithNumber: '4811',
    arabicText: 'الرَّجُلُ عَلَى دِينِ خَلِيلِهِ فَلْيَنْظُرْ أَحَدُكُمْ مَنْ يُخَالِلُ‏.',
    englishText: 'The Prophet (ﷺ) said: "A man follows the religion of his friend; so each one of you should consider whom he makes his friend."',
    chapterName: 'Manners',
    grade: 'Hasan',
    gradedBy: 'Al-Albani'
  },
  {
    id: 'tirmidhi:2317',
    collection: 'tirmidhi',
    hadithNumber: '2317',
    arabicText: 'مِنْ حُسْنِ إِسْلاَمِ الْمَرْءِ تَرْكُهُ مَا لاَ يَعْنِيِهِ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Indeed, among the excellence of a person\'s Islam is his leaving alone that which does not concern him."',
    chapterName: 'Asceticism (Zuhd)',
    grade: 'Sahih',
    gradedBy: 'Al-Albani'
  },
  {
    id: 'ibnmajah:76',
    collection: 'ibnmajah',
    hadithNumber: '76',
    arabicText: 'طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Seeking knowledge is a duty upon every Muslim."',
    chapterName: 'Introduction',
    grade: 'Sahih',
    gradedBy: 'Al-Albani'
  },
  {
    id: 'tirmidhi:1910',
    collection: 'tirmidhi',
    hadithNumber: '1910',
    arabicText: 'مَنْ لَمْ يَشْكُرِ النَّاسَ لَمْ يَشْكُرِ اللَّهَ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "Whoever does not thank people, does not thank Allah."',
    chapterName: 'Virtues & Relations',
    grade: 'Sahih',
    gradedBy: 'At-Tirmidhi'
  },
  {
    id: 'tirmidhi:2653',
    collection: 'tirmidhi',
    hadithNumber: '2653',
    arabicText: 'الْمُسْلِمُ مَنْ سَلِمَ الْمُسْلِمُونَ مِنْ لِسَانِهِ وَيَدِهِ، وَالْمُؤْمِنُ مَنْ أَمِنَهُ النَّاسُ عَلَى دِمَائِهِمْ وَأَمْوَالِهِمْ‏.',
    englishText: 'The Messenger of Allah (ﷺ) said: "The Muslim is the one from whose tongue and hand other Muslims are safe, and the believer is the one whom people trust with their lives and their wealth."',
    chapterName: 'Faith',
    grade: 'Sahih',
    gradedBy: 'At-Tirmidhi'
  },
  {
    id: 'abudawud:4599',
    collection: 'abudawud',
    hadithNumber: '4599',
    arabicText: 'إِنَّ اللَّهَ يُبْغِضُ الْفَاحِشَ الْبَذِيءَ‏.',
    englishText: 'The Prophet (ﷺ) said: "Allah hates the speaker of evil, coarse language."',
    chapterName: 'Manners',
    grade: 'Da\'if',
    gradedBy: 'Abu Dawud (Graded Da\'if due to chain discontinuity)'
  }
];
