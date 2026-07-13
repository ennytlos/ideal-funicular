'use client';

import React, { useState } from 'react';
import Navbar from '../../components/Navbar';

interface RuqyahItem {
  id: string;
  title: string;
  source: string;
  arabic: string;
  transliteration: string;
  translation: string;
  recommendedCount: number;
}

const RUQYAH_SELECTIONS: RuqyahItem[] = [
  {
    id: 'fatihah',
    title: 'Surah Al-Fatihah (The Opening)',
    source: 'Quran 1',
    arabic: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴿١﴾ الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ ﴿٢﴾ الرَّحْمَٰنِ الرَّحِيمِ ﴿٣﴾ مَالِكِ يَوْمِ الدِّينِ ﴿٤﴾ إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ ﴿٥﴾ اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ ﴿٦﴾ صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ ﴿٧﴾',
    transliteration: 'Bismillaahir Rahmaanir Raheem. Alhamdu lillaahi Rabbil \'aalameen. Ar-Rahmaanir-Raheem. Maaliki Yawmid-Deen. Iyyaaka na\'budu wa iyyaaka nasta\'een. Ihdinas-Siraatal-Mustaqeem. Siraatal-ladheena an\'amta \'alayhim ghayril-maghdoobi \'alayhim wa lad-daalleen.',
    translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful. [All] praise is [due] to Allah, Lord of the worlds. The Entirely Merciful, the Especially Merciful. Sovereign of the Day of Recompense. It is You we worship and You we ask for help. Guide us to the straight path. The path of those upon whom You have bestowed favor, not of those who have earned [Your] anger or of those who are astray.',
    recommendedCount: 7
  },
  {
    id: 'kursi',
    title: 'Ayatul Kursi (The Verse of the Throne)',
    source: 'Quran 2:255',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَّهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَن ذَا الَّذِي يَشْفَعُ عِندَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِّنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    transliteration: 'Allaahu laa ilaaha illaa Huwal-Hayyul-Qayyeum; laa ta\'khudhuhu sinatuw wa laa nawm; lahu maa fis-samaawaati wa maa fil-ard; man dhal-ladhee yashfa\'u \'indahuu illaa bi-idhnih; ya\'lamu maa bayna aydeehim wa maa khalfahum, wa laa yuheetoona bishay\'im min \'ilmihi illaa bimaa shaaa\'; wasi\'a Kursiyyuhus-samaawaati wal-ard, wa laa ya\'ooduhu hifdhuhumaa; wa Huwal-\'Aliyyul-\'Adheem.',
    translation: 'Allah - there is no deity except Him, the Ever-Living, the Sustainer of [all] existence. Neither drowsiness overtakes Him nor sleep. To Him belongs whatever is in the heavens and whatever is on the earth. Who is it that can intercede with Him except by His permission? He knows what is [presently] before them and what will be after them, and they encompass not a thing of His knowledge except for what He wills. His Throne extends over the heavens and the earth, and their preservation tires Him not. And He is the Most High, the Most Great.',
    recommendedCount: 3
  },
  {
    id: 'baqarah_end',
    title: 'Last Two Verses of Surah Al-Baqarah',
    source: 'Quran 2:285-286',
    arabic: 'آمَنَ الرَّسُولُ بِمَا أُنزِلَ إِلَيْهِ مِن رَّبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِّن رُّسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْهِ الْمَصِيرُ ﴿٢٨٥﴾ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ ﴿٢٨٦﴾',
    transliteration: 'Aamanar-Rasoolu bimaaa unzila ilaihi mir-Rabbihee wal-mu\'minoon; kullun aamana billaahi wa Malaaa\'ikatihee wa Kutubihee wa Rusulih, laa nufarriqu bayna ahadim mir-rusulih; wa qaaloo sami\'naa wa ata\'naa ghufraanaka Rabbanaa wa ilaikal-maseer. Laa yukallifullaahu nafsan illaa wus\'ahaa; lahaa maa kasabat wa \'alaihaa maktasabat; Rabbanaa laa tu\'aakhidhnaaa in naseenaaa aw akhta\'naa; Rabbanaa wa laa tahmil \'alainaaa isran kamaa hamaltahoo \'alalladheena min qablinaa; Rabbanaa wa laa tuhammilnaa maa laa taaqata lanaa bih; wa\'fu \'annaa waghfir lanaa warhamnaa; Anta mawlaanaa fansurnaa \'alal-qawmil-kaafireen.',
    translation: 'The Messenger has believed in what was revealed to him from his Lord, and [so have] the believers. All of them have believed in Allah and His angels and His books and His messengers, [saying], "We make no distinction between any of His messengers." And they say, "We hear and we obey. [We seek] Your forgiveness, our Lord, and to You is the [final] destination." Allah does not charge a soul except [with that within] its capacity. It will have [the consequence of] what [good] it has gained, and it will bear [the consequence of] what [evil] it has earned. "Our Lord, do not impose blame upon us if we have forgotten or erred. Our Lord, and lay not upon us a burden like that which You laid upon those before us. Our Lord, and burden us not with that which we have no ability to bear. And pardon us; and forgive us; and have mercy upon us. You are our protector, so give us victory over the disbelieving people."',
    recommendedCount: 1
  },
  {
    id: 'ikhlas',
    title: 'Surah Al-Ikhlas (The Sincerity)',
    source: 'Quran 112',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ﴿١﴾ اللَّهُ الصَّمَدُ ﴿٢﴾ لَمْ يَلِدْ وَلَمْ يُولَدْ ﴿٣﴾ وَلَمْ يَكُن لَّهُ كُفُوًا أَحَدٌ ﴿٤﴾',
    transliteration: 'Qul Huwal-Laahu Ahad. Allaahus-Samad. Lam yalid wa lam yoolad. Wa lam yakul-lahoo kufuwan ahad.',
    translation: 'Say, "He is Allah, [who is] One. Allah, the Eternal Refuge. He neither begets nor is born. Nor is there to Him any equivalent."',
    recommendedCount: 3
  },
  {
    id: 'falaq',
    title: 'Surah Al-Falaq (The Daybreak)',
    source: 'Quran 113',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ﴿١﴾ مِن شَرِّ مَا خَلَقِ ﴿٢﴾ وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ ﴿٣﴾ وَمِن شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ﴿٤﴾ وَمِن شَرِّ حَاسِدٍ إِذَا حَسَدَ ﴿٥﴾',
    transliteration: 'Qul a\'oodhu bi-Rabbil-Falaq. Min sharri maa khalaq. Wa min sharri ghaasiqin idhaa waqab. Wa min sharrin-naffaathaati fil-\'uqad. Wa min sharri haasidin idhaa hasad.',
    translation: 'Say, "I seek refuge in the Lord of the daybreak. From the evil of that which He created. And from the evil of darkness when it settles. And from the evil of the blowers in knots. And from the item of an envier when he envies."',
    recommendedCount: 3
  },
  {
    id: 'nas',
    title: 'Surah An-Nas (Mankind)',
    source: 'Quran 114',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ﴿١﴾ مَلِكِ النَّاسِ ﴿٢﴾ إِلَٰهِ النَّاسِ ﴿٣﴾ مِن شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ﴿٤﴾ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ﴿٥﴾ مِنَ الْجِنَّةِ وَالنَّاسِ ﴿٦﴾',
    transliteration: 'Qul a\'oodhu bi-Rabbin-Naas. Malikin-Naas. Ilaahin-Naas. Min sharril-waswaasil-khannaas. Alladhee yuwaswisu fee sudoorin-Naas. Minal-Jinnati wan-Naas.',
    translation: 'Say, "I seek refuge in the Lord of mankind. The Sovereign of mankind. The God of mankind. From the evil of the retreating whisperer - Who whispers [evil] into the breasts of mankind - From among the jinn and mankind."',
    recommendedCount: 3
  },
  {
    id: 'sunnah1',
    title: 'Prophetic Prayer for Physical/Spiritual Healing',
    source: 'Sahih Al-Bukhari & Muslim',
    arabic: 'أَذْهِبِ الْبَاسَ رَبَّ النَّاسِ، وَاشْفِ أَنْتَ الشَّافِي، لاَ شِفَاءَ إِلاَّ شِفَاؤُكَ، شِفَاءً لاَ يُغَادِرُ سَقَمًا',
    transliteration: 'Adhhibil-ba\'sa Rabban-naas, washfi Antash-Shaafi, laa shifaa\'a illaa shifaa\'uka, shifaa\'an laa yughaadiru saqamaa.',
    translation: 'Remove the disease, O Lord of the people! Cure him/her, for You are the Great Curer. There is no cure but Yours, a cure that leaves behind no disease.',
    recommendedCount: 7
  },
  {
    id: 'sunnah2',
    title: 'Supplication of Protection and Relief',
    source: 'Sahih Al-Bukhari',
    arabic: 'أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّةِ، مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لcurrentلَامَّةٍ',
    transliteration: 'A\'udhu bi-kalimaatillaahit-taammah, min kulli shaytaanin wa haammah, wa min kulli \'aynin laammah.',
    translation: 'I seek refuge in the perfect words of Allah from every devil and poisonous pest, and from every evil envious eye.',
    recommendedCount: 3
  }
];

export default function RuqyahPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const handleIncrement = (id: string, recommended: number) => {
    const currentVal = counts[id] || 0;
    if (currentVal < recommended) {
      setCounts(prev => ({ ...prev, [id]: currentVal + 1 }));
    }
  };

  const handleReset = (id: string) => {
    setCounts(prev => ({ ...prev, [id]: 0 }));
  };

  const handleResetAll = () => {
    setCounts({});
  };

  return (
    <>
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
        <Navbar />

        <div className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', maxWidth: '800px' }}>
          
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <span style={{
              background: 'rgba(220, 38, 38, 0.1)',
              color: 'var(--accent-red)',
              padding: '0.4rem 1rem',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              fontFamily: 'Outfit',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              border: '1px solid rgba(220, 38, 38, 0.2)',
              display: 'inline-block',
              marginBottom: '1rem'
            }}>
              Prophetic Medicine & Healing
            </span>
            <h1 style={{ fontFamily: 'Outfit', fontSize: '3rem', margin: '0 0 0.75rem 0' }}>
              Ruqyah <span style={{ color: 'var(--accent-red)' }}>Read</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              Access authentic Quranic chapters and Prophetic supplications for spiritual protection, relief, and divine cure. Track your recitations below.
            </p>

            <button
              onClick={handleResetAll}
              className="btn btn-secondary"
              style={{ marginTop: '1.5rem', borderRadius: '20px', padding: '0.5rem 1.5rem', fontSize: '0.85rem' }}
            >
              Reset All Progress Counters
            </button>
          </div>

          {/* Devotional Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
            {RUQYAH_SELECTIONS.map((item) => {
              const currentVal = counts[item.id] || 0;
              const isCompleted = currentVal >= item.recommendedCount;

              return (
                <div
                  key={item.id}
                  className="glass-card"
                  style={{
                    padding: '2.25rem',
                    borderRadius: '16px',
                    border: isCompleted 
                      ? '1px solid rgba(212, 175, 55, 0.4)' 
                      : '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    boxShadow: isCompleted 
                      ? '0 8px 30px rgba(212, 175, 55, 0.08)' 
                      : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Card Header Info */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontFamily: 'Outfit', fontSize: '1.25rem', margin: 0, color: 'var(--text-primary)' }}>{item.title}</h3>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{item.source}</span>
                    </div>

                    {/* Counter badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: isCompleted ? 'var(--accent-gold)' : 'var(--text-secondary)'
                      }}>
                        {currentVal} / {item.recommendedCount} Recitations
                      </span>
                    </div>
                  </div>

                  {/* Arabic text with proper script typography */}
                  <div style={{
                    direction: 'rtl',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                    fontSize: '1.8rem',
                    lineHeight: 2.2,
                    color: 'var(--text-primary)',
                    textAlign: 'right',
                    padding: '1.5rem',
                    background: 'rgba(0,0,0,0.02)',
                    borderRadius: '8px',
                    wordSpacing: '2px',
                  }}>
                    {item.arabic}
                  </div>

                  {/* Transliteration */}
                  <div style={{ fontSize: '0.9rem', fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong style={{ fontStyle: 'normal', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>TRANSLITERATION:</strong>
                    {item.transliteration}
                  </div>

                  {/* Translation */}
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <strong style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '0.2rem' }}>TRANSLATION:</strong>
                    {item.translation}
                  </div>

                  {/* Counters Actions */}
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => handleIncrement(item.id, item.recommendedCount)}
                      disabled={isCompleted}
                      style={{
                        flex: 1,
                        padding: '0.8rem',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: isCompleted ? 'default' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        background: isCompleted 
                          ? 'rgba(212, 175, 55, 0.15)' 
                          : 'var(--accent-red-gradient)',
                        color: isCompleted ? 'var(--accent-gold)' : '#fff',
                        boxShadow: isCompleted ? 'none' : '0 4px 15px rgba(220, 38, 38, 0.2)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {isCompleted ? '✓ Read Completed' : '➕ Increment Counter'}
                    </button>

                    <button
                      onClick={() => handleReset(item.id)}
                      className="btn btn-secondary"
                      style={{ padding: '0.8rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}
                      title="Reset this item"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </>
  );
}
