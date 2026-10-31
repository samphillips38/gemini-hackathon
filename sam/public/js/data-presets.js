// Pre-loaded historical textbooks and local fallback textbook parser/character responder

export const PRESET_TEXTBOOKS = {
  athens: {
    id: 'athens',
    title: 'The Peloponnesian War & Classical Athens',
    subtitle: '431–404 BCE • Democracy, Empire & Philosophy',
    author: 'Adapted from Thucydides, Plutarch & Aristotle',
    era: 'Classical Greece (5th Century BCE)',
    themeStyle: 'classical',
    coverColor: '#1b365d',
    accentColor: '#e5b84b',
    synopsis:
      'An exploration of fifth-century BCE Athens at the height of its Golden Age and its fateful twenty-seven-year struggle against the Peloponnesian League led by Sparta. Examines radical direct democracy, maritime empire, civic rhetoric, and the birth of moral philosophy.',
    worldSetting: {
      locationName: 'The Athenian Agora & Acropolis Precinct',
      atmosphereDescription:
        'Sunlit Pentelic marble colonnades, olive groves, bronze tripods, and the open assembly stones where citizens debated war, justice, and empire.',
      skyColor: '#1d3557',
      horizonColor: '#e09f67',
      groundColor: '#3a4234',
      plazaColor: '#c9bfae'
    },
    chapters: [
      {
        number: 1,
        title: 'The Delian League & Imperial Athens',
        summary:
          'Following the Persian Wars, Athens transformed a voluntary naval alliance into a tributary maritime empire, moving the treasury from Delos to the Acropolis in 454 BCE.',
        keyExcerpt:
          '“What began as a common defense of the Aegean islands against Persia gradually became an Athenian archē—an empire sustained by triremes, silver from Laurium, and tribute from over two hundred poleis.”'
      },
      {
        number: 2,
        title: 'Radical Democracy & The Funeral Oration',
        summary:
          'Under Pericles, citizenship and pay for public office empowered ordinary rowers and craftsmen (thetes) to vote directly in the Ecclesia and serve on 500-citizen juries.',
        keyExcerpt:
          '“Our constitution does not copy the laws of neighboring states; we are rather a pattern to others than imitators ourselves. Its administration favors the many instead of the few; this is why it is called a democracy.” — Pericles, 431 BCE'
      },
      {
        number: 3,
        title: 'Plague, Demagogues & The Sicilian Expedition',
        summary:
          'Besieged behind the Long Walls, Athens suffered a devastating plague in 430 BCE. After the Peace of Nicias, ambition led to the catastrophic 415 BCE invasion of Syracuse.',
        keyExcerpt:
          '“Fear of Sparta’s land army and Athens’ unyielding naval ambition trapped both powers in what Thucydides diagnosed as the inevitable collision of a rising power and an established hegemon.”'
      },
      {
        number: 4,
        title: 'The Gadfly of the Agora: Philosophy on Trial',
        summary:
          'Amidst political turmoil and the aftermath of defeat in 404 BCE, Socrates questioned conventional piety and rhetoric, culminating in his trial in 399 BCE.',
        keyExcerpt:
          '“An unexamined life is not worth living. I go around doing nothing but persuading you, both young and old, not to care for your bodies or your wealth so intensely as for the highest welfare of your souls.”'
      }
    ],
    characters: [
      {
        id: 'pericles',
        name: 'Pericles of Athens',
        title: 'Strategos & Architect of the Golden Age',
        faction: 'Athenian Democratic Assembly',
        years: 'c. 495–429 BCE',
        avatarStyle: {
          robeColor: '#f1ede4',
          cloakColor: '#1e40af',
          headgear: 'helmet',
          prop: 'scroll'
        },
        position: { x: -10, z: -8 },
        greeting:
          'Greetings, citizen. Look upon these marble colonnades and the Long Walls stretching to Piraeus. We built a school for all Hellas—yet empire is a perilous burden to hold.',
        bio: 'Leading statesman of Athens during its Golden Age. Pericles championed public building works including the Parthenon, introduced pay for jury duty so poor citizens could participate in democracy, and devised the defensive naval strategy at the outbreak of the Peloponnesian War.',
        personality:
          'Measured, eloquent, civic-minded, and dignified. Speaks with the cadence of classical oratory and weighs strategic necessity against democratic ideals.',
        keyFacts: [
          'Transferred the Delian League treasury from Delos to Athens in 454 BCE, funding the Acropolis rebuilding program.',
          'Instituted misthophoria (public pay for jurors and magistrates) to enable working-class citizens to participate in governance.',
          'Advocated a "Periclean Grand Strategy": avoiding land battles with Sparta while relying on naval supremacy and the Long Walls.',
          'Delivered the famous Funeral Oration in 431/430 BCE defining Athenian civic identity, before dying in the Plague of Athens in 429 BCE.'
        ],
        suggestedQuestions: [
          'Why did you tell Athenians to abandon their farms and stay behind the Long Walls?',
          'How can Athens claim to be a democracy while ruling over allied islands as an empire?',
          'What did you mean when you called Athens "the school of Hellas"?'
        ]
      },
      {
        id: 'aspasia',
        name: 'Aspasia of Miletus',
        title: 'Rhetorician, Philosopher & Intellectual Host',
        faction: 'Periclean Intellectual Circle',
        years: 'c. 470–400 BCE',
        avatarStyle: {
          robeColor: '#7c2d12',
          cloakColor: '#eab308',
          headgear: 'diadem',
          prop: 'book'
        },
        position: { x: 11, z: -9 },
        greeting:
          'Welcome to our symposium! While the Assembly debates triremes and tribute, here we dissect the art of persuasion, natural philosophy, and who truly holds a voice in this polis.',
        bio: 'Born in the Ionian city of Miletus, Aspasia came to Athens as a metic (resident foreigner) and became renowned for her mastery of rhetoric and philosophy. Her home attracted Socrates, Anaxagoras, and Phidias, and ancient writers credited her with shaping Pericles’ greatest speeches.',
        personality:
          'Incisive, warm, witty, and intellectually fearless. Highlights both the brilliance of Athenian intellectual life and the exclusions of women and metics.',
        keyFacts: [
          'As an Ionian metic, she was unbound by the strict seclusion imposed on citizen wives in classical Athens.',
          'Plato’s dialogue Menexenus credits Aspasia with teaching rhetoric to both Pericles and Socrates.',
          'Faced political attacks and impiety accusations from comic playwrights and rivals seeking to undermine Pericles.',
          'Demonstrates how non-citizens contributed centrally to Athens’ philosophical and rhetorical revolution.'
        ],
        suggestedQuestions: [
          'What was life like for women and foreign-born metics in democratic Athens?',
          'Did you really help compose Pericles’ famous Funeral Oration?',
          'How did you teach Socrates and Athenian statesmen the art of rhetoric?'
        ]
      },
      {
        id: 'socrates',
        name: 'Socrates of Alopece',
        title: 'Moral Philosopher & Veteran Hoplite',
        faction: 'Philosophical Inquiry (The Socratic Circle)',
        years: '470–399 BCE',
        avatarStyle: {
          robeColor: '#d6cfc2',
          cloakColor: '#57534e',
          headgear: 'none',
          prop: 'staff'
        },
        position: { x: -12, z: 9 },
        greeting:
          'Hold a moment, friend! Before you hurry past the Agora—tell me, when the Assembly votes on what is "just" or "courageous," do any of us actually know what justice is?',
        bio: 'Athenian philosopher who fought bravely as a hoplite at Potidaea, Delium, and Amphipolis, yet spent his life barefoot in the Agora questioning politicians, poets, and craftsmen. Using the elenchus (Socratic method), he exposed false conceit of wisdom.',
        personality:
          'Curious, ironic, humble yet probing. Loves answering a question with a clarifying counter-question that helps the student discover truth.',
        keyFacts: [
          'Developed the Socratic Method (elenchus): testing definitions of virtue through cooperative cross-examination.',
          'Refused to collaborate with the oligarchic Thirty Tyrants in 404 BCE, risking his life rather than arrest Leon of Salamis.',
          'Served with distinction as a heavy infantry hoplite during the Peloponnesian War.',
          'Tried and condemned to death in 399 BCE on charges of impiety and corrupting the youth of Athens.'
        ],
        suggestedQuestions: [
          'Why do you question citizens in the Agora instead of writing books?',
          'Why were you critical of radical democracy and voting by popular passion?',
          'Why did you refuse to escape prison when Crito offered you a way out?'
        ]
      },
      {
        id: 'thucydides',
        name: 'Thucydides the Historian',
        title: 'Exiled Strategos & Scientific Historian',
        faction: 'Historical Chroniclers',
        years: 'c. 460–400 BCE',
        avatarStyle: {
          robeColor: '#292524',
          cloakColor: '#0f766e',
          headgear: 'laurel',
          prop: 'scroll'
        },
        position: { x: 12, z: 10 },
        greeting:
          'I am writing my history not as a prize-essay to win the applause of the moment, but as a possession for all time. Tell me what you wish to examine.',
        bio: 'Athenian general and author of the History of the Peloponnesian War. After failing to save Amphipolis from the Spartan general Brasidas in 424 BCE, he was exiled for twenty years, allowing him to interview witnesses from both sides of the conflict.',
        personality:
          'Analytical, unsentimental, observant, and deeply concerned with human nature (anthropinon), power politics, and evidentiary accuracy.',
        keyFacts: [
          'Rejected mythological explanations of history, insisting on eyewitness cross-examination and human causation.',
          'Survived the Plague of Athens in 430 BCE and left a clinical description of its physical and social breakdown.',
          'Exiled in 424 BCE after the loss of Amphipolis, which gave him access to Peloponnesian as well as Athenian sources.',
          'Immortalized the Melian Dialogue (416 BCE): "The strong do what they can and the weak suffer what they must."'
        ],
        suggestedQuestions: [
          'What truly caused the Peloponnesian War between Athens and Sparta?',
          'What happened during the Melian Dialogue, and why did it shock the Greek world?',
          'How did your exile allow you to write a fairer history of the war?'
        ]
      },
      {
        id: 'alcibiades',
        name: 'Alcibiades',
        title: 'Charismatic General & Political Chameleon',
        faction: 'Athens / Sparta / Persia (Shifting)',
        years: 'c. 450–404 BCE',
        avatarStyle: {
          robeColor: '#581c87',
          cloakColor: '#f59e0b',
          headgear: 'helmet',
          prop: 'sword'
        },
        position: { x: 0, z: -16 },
        greeting:
          'Stand still? In a city that hungers for glory? Sicily was within our grasp until my rivals recalled me! Ask me how empires are won—and lost.',
        bio: 'Ward of Pericles and devoted pupil of Socrates, Alcibiades was brilliant, flamboyant, and fatally ambitious. He championed the massive 415 BCE Sicilian Expedition, defected to Sparta when prosecuted for the mutilation of the Hermai, later advised Persia, and was eventually recalled to lead victorious Athenian fleets.',
        personality:
          'Dazzling, bold, unapologetic, and dramatic. Embodies the restless ambition and factional instability of late 5th-century Athens.',
        keyFacts: [
          'Persuaded the Athenian Assembly over Nicias’ objections to launch the massive 415 BCE invasion of Sicily.',
          'Fled to Sparta after being accused of profaning the Eleusinian Mysteries and defacing the sacred Hermai statues.',
          'Advised Sparta to fortify Decelea inside Attica and send a Spartan commander (Gylippus) to Syracuse.',
          'Returned to command Athenian naval victories in the Hellespont before his final exile.'
        ],
        suggestedQuestions: [
          'Why did you push Athens to invade Sicily while the truce with Sparta was fragile?',
          'How could you defect to Sparta and advise them against your own home city?',
          'What did you learn from Socrates, and why didn’t you follow his restraint?'
        ]
      }
    ],
    landmarks: [
      {
        id: 'parthenon',
        name: 'The Parthenon Sanctuary',
        type: 'temple',
        description:
          'Doric temple dedicated to Athena Parthenos, built between 447 and 432 BCE using Delian League tribute. It housed both Phidias’ gold-and-ivory statue and the imperial treasury.',
        x: 0,
        z: -24
      },
      {
        id: 'pnyx',
        name: 'Bema of the Pnyx Assembly',
        type: 'amphitheater',
        description:
          'The stone speaker’s platform where any male Athenian citizen could address the Ecclesia (Assembly) of 6,000 citizens on war, peace, and law.',
        x: -20,
        z: -2
      },
      {
        id: 'stoa',
        name: 'Stoa Poikile (Painted Colonnade)',
        type: 'arch',
        description:
          'Covered marble walkway bordering the Agora where philosophers, merchants, and magistrates gathered beneath murals of the Battle of Marathon.',
        x: 20,
        z: -2
      },
      {
        id: 'tribute_stele',
        name: 'Athenian Tribute Lists Stele',
        type: 'obelisk',
        description:
          'Inscribed marble slabs recording the one-sixtieth "first fruits" (aparchai) paid to Athena from the annual tribute of over 200 allied cities.',
        x: -14,
        z: -18
      },
      {
        id: 'klepsydra',
        name: 'Dicastery Water Clock Fountain',
        type: 'fountain',
        description:
          'In Athenian people’s courts (Heliaia), bronze-and-clay water clocks (klepsydrai) ensured every speaker received strictly equal time before the 501 jurors.',
        x: 15,
        z: 18
      }
    ]
  },

  revolution: {
    id: 'revolution',
    title: 'The French Revolution: Liberty, Equality, Fraternity',
    subtitle: '1789–1794 • Enlightenment, Upheaval & The Republic',
    author: 'Primary Sources & Archives Parlementaires',
    era: 'The French Revolution (Late 18th Century)',
    themeStyle: 'revolution',
    coverColor: '#7f1d1d',
    accentColor: '#f59e0b',
    synopsis:
      'From the fiscal collapse of the Ancien Régime and the convocation of the Estates-General in 1789 to the Declaration of the Rights of Man and of the Woman, the fall of the monarchy, and the crucible of the Reign of Terror.',
    worldSetting: {
      locationName: 'Place de la Révolution & Palais-Royal Arcade',
      atmosphereDescription:
        'Cobblestone Parisian squares lit by iron street lanterns, tricolor banners, pamphlets fluttering from printing presses, and neoclassical civic monuments.',
      skyColor: '#1e1b4b',
      horizonColor: '#b45309',
      groundColor: '#33353a',
      plazaColor: '#78716c'
    },
    chapters: [
      {
        number: 1,
        title: 'The Three Estates & The Tennis Court Oath',
        summary:
          'Burdened by war debt and regressive taxation, Louis XVI summoned the Estates-General in May 1789. The Third Estate broke away to form the National Assembly.',
        keyExcerpt:
          '“What is the Third Estate? Everything. What has it been hitherto in the political order? Nothing. What does it demand? To become something.” — Abbé Sieyès, January 1789'
      },
      {
        number: 2,
        title: 'Bastille, Bread & The Rights of Man',
        summary:
          'Popular uprising on July 14, 1789 saved the National Assembly, followed by the abolition of feudalism on August 4 and the Declaration of the Rights of Man and of the Citizen.',
        keyExcerpt:
          '“Article 1: Men are born and remain free and equal in rights. Social distinctions may be founded only upon the general good.” — August 26, 1789'
      },
      {
        number: 3,
        title: 'Universal Rights Contested: Women & Citizens',
        summary:
          'Working women marched on Versailles in October 1789, while Olympe de Gouges challenged the revolution to extend full political equality to women and abolish colonial slavery.',
        keyExcerpt:
          '“Woman has the right to mount the scaffold; she must equally have the right to mount the rostrum.” — Olympe de Gouges, 1791'
      },
      {
        number: 4,
        title: 'War, The Republic & The Reign of Terror',
        summary:
          'War with European monarchies and internal crisis radicalized the Revolution in 1792–1794 under the Committee of Public Safety before Thermidor.',
        keyExcerpt:
          '“To punish the oppressors of humanity is clemency; to forgive them is barbarity.” — Maximilien Robespierre, 1794'
      }
    ],
    characters: [
      {
        id: 'lafayette',
        name: 'Marquis de Lafayette',
        title: 'Commander of the Paris National Guard',
        faction: 'Constitutional Monarchists / Feuillants',
        years: '1757–1834',
        avatarStyle: {
          robeColor: '#1e3a8a',
          cloakColor: '#dc2626',
          headgear: 'tricorne',
          prop: 'sword'
        },
        position: { x: -11, z: -7 },
        greeting:
          'Citizen! Look at this cockade on my hat—blue and red for Paris, joined with white to bind the nation in constitutional liberty. Can we secure freedom without descending into chaos?',
        bio: 'Hero of the American Revolution who drafted the initial version of the Declaration of the Rights of Man and of the Citizen (with input from Thomas Jefferson) and commanded the National Guard after the storming of the Bastille.',
        personality:
          'Idealistic, chivalrous, moderate reformer caught between royal absolutism and radical Jacobin insurrection.',
        keyFacts: [
          'Presented the first draft of the Declaration of the Rights of Man and of the Citizen to the National Assembly on July 11, 1789.',
          'Created the tricolor cockade (blue, white, and red) days after the fall of the Bastille.',
          'Attempted to maintain constitutional order between King Louis XVI and the Parisian sans-culottes.',
          'Fled France in 1792 after the radical overthrow of the constitutional monarchy and was imprisoned in Austria.'
        ],
        suggestedQuestions: [
          'How did your experience in the American Revolution shape the Declaration of the Rights of Man?',
          'Why did you believe France needed a constitutional monarch rather than a radical republic?',
          'What was the meaning behind the tricolor cockade you designed?'
        ]
      },
      {
        id: 'olympe',
        name: 'Olympe de Gouges',
        title: 'Playwright, Abolitionist & Feminist Theorist',
        faction: 'Girondin Sympathizer / Cercle Social',
        years: '1748–1793',
        avatarStyle: {
          robeColor: '#6b21a8',
          cloakColor: '#f3e8ff',
          headgear: 'diadem',
          prop: 'scroll'
        },
        position: { x: 11, z: -8 },
        greeting:
          'Read this pamphlet fresh from the press! The deputies proclaim that "all men are born free," yet half the nation—and enslaved people in the colonies—are left in chains!',
        bio: 'French playwright and political activist who authored the Declaration of the Rights of Woman and of the Female Citizen in September 1791, demanding equal legal, property, and voting rights for women, as well as the abolition of slavery.',
        personality:
          'Passionate, courageous, sharp-witted, and uncompromisingly committed to universal human rights and non-violence.',
        keyFacts: [
          'Published the "Declaration of the Rights of Woman and of the Female Citizen" in 1791 as a direct point-by-point challenge to the 1789 Declaration.',
          'Campaigned against colonial slavery through plays like Zamore et Mirza and anti-slavery tracts.',
          'Proposed voluntary patriotic taxes, maternity hospitals, and civil divorce laws.',
          'Opposed the execution of Louis XVI and the violence of the Jacobin Terror, leading to her trial and execution in November 1793.'
        ],
        suggestedQuestions: [
          'Why did you write the Declaration of the Rights of Woman in 1791?',
          'How did the male revolutionaries react to women demanding the right to vote and hold office?',
          'Why did you oppose both the slave trade and the Reign of Terror?'
        ]
      },
      {
        id: 'robespierre',
        name: 'Maximilien Robespierre',
        title: 'Member of the Committee of Public Safety',
        faction: 'The Mountain (Montagnards / Jacobins)',
        years: '1758–1794',
        avatarStyle: {
          robeColor: '#1f2937',
          cloakColor: '#b91c1c',
          headgear: 'tricorne',
          prop: 'book'
        },
        position: { x: -10, z: 10 },
        greeting:
          'Virtue without terror is fatal; terror without virtue is powerless. Tell me, citizen—when foreign armies invade and conspirators hoard grain, how else can a newborn Republic survive?',
        bio: 'Provincial lawyer from Arras known as "The Incorruptible." Originally an opponent of the death penalty and war, Robespierre rose to lead the Jacobin Club and the Committee of Public Safety during the crisis of 1793–1794.',
        personality:
          'Austere, doggedly ideological, steeped in Rousseau’s concept of the General Will and civic virtue.',
        keyFacts: [
          'Advocated universal male suffrage, abolition of celibacy requirements, and price controls (the General Maximum) on bread.',
          'Initially opposed going to war against Austria in 1792, warning that war would breed military dictatorship.',
          'Dominated the Committee of Public Safety during the Reign of Terror (1793–1794) to crush counter-revolution.',
          'Overthrown and executed during the Thermidorian Reaction on July 28, 1794 (10 Thermidor Year II).'
        ],
        suggestedQuestions: [
          'How did you go from opposing the death penalty in 1791 to defending the Reign of Terror in 1794?',
          'What did you mean by connecting "Virtue" and "Terror" in a republic?',
          'Why did you warn against declaring war on Austria when the Girondins wanted it?'
        ]
      },
      {
        id: 'danton',
        name: 'Georges Jacques Danton',
        title: 'Tribune of the Cordeliers & First President of Public Safety',
        faction: 'Cordeliers / Indulgents',
        years: '1759–1794',
        avatarStyle: {
          robeColor: '#78350f',
          cloakColor: '#d97706',
          headgear: 'none',
          prop: 'lantern'
        },
        position: { x: 11, z: 9 },
        greeting:
          'De l’audace, encore de l’audace, toujours de l’audace! Audacity saved France when the Prussians marched on Paris—but now the Revolution is devouring its own children!',
        bio: 'Booming orator of the Cordeliers Club and Minister of Justice in 1792 who rallied French citizens against Prussian invasion. By late 1793, Danton and Camille Desmoulins led the "Indulgents," calling for an end to the Terror.',
        personality:
          'Thunderous, pragmatic, earthy, passionate lover of life who sought national reconciliation once the foreign invasion was repelled.',
        keyFacts: [
          'Electrified the Assembly on September 2, 1792 with his call for "audacity, more audacity, always audacity!"',
          'Helped establish the Revolutionary Tribunal and first Committee of Public Safety during the military emergency of 1793.',
          'Formed the "Indulgents" faction with journalist Camille Desmoulins in late 1793 to halt revolutionary executions.',
          'Arrested by his former allies and guillotined in April 1794, famously telling the executioner: "Show my head to the people; it is well worth seeing."'
        ],
        suggestedQuestions: [
          'How did you rally the people of Paris when Prussian armies invaded in 1792?',
          'Why did you break with Robespierre and call for mercy as an "Indulgent"?',
          'What was the difference between the Cordeliers Club and the Jacobins?'
        ]
      }
    ],
    landmarks: [
      {
        id: 'bastille_ruins',
        name: 'Bastille Fortress Stones',
        type: 'fortress',
        description:
          'Stormed on July 14, 1789 by Parisian artisans and National Guardsmen seeking gunpowder. Entrepreneur Pierre-François Palloy dismantled its stones into miniature souvenir replicas.',
        x: 0,
        z: -23
      },
      {
        id: 'rights_monument',
        name: 'Tablets of the Declaration of Rights',
        type: 'obelisk',
        description:
          'Adopted August 26, 1789, proclaiming popular sovereignty, freedom of speech, and equality before the law.',
        x: -18,
        z: -3
      },
      {
        id: 'printing_press',
        name: 'Revolutionary Pamphlet Press',
        type: 'arch',
        description:
          'The abolition of royal censorship unleashed over 500 newspapers in Paris, from Marat’s L’Ami du peuple to Desmoulins’ Le Vieux Cordelier.',
        x: 18,
        z: -3
      },
      {
        id: 'liberty_tree',
        name: 'Altar of the Fatherland & Liberty Column',
        type: 'statue',
        description:
          'Civic festival monument where citizens swore oaths to the Nation, the Law, and the Constitution.',
        x: 0,
        z: 19
      }
    ]
  },

  silkroad: {
    id: 'silkroad',
    title: 'The Silk Road & Cosmopolitan Chang’an',
    subtitle: '618–907 CE • Tang Dynasty Trade, Faith & Innovation',
    author: 'Adapted from Tang Annals & Xuanzang’s Records',
    era: 'Tang Dynasty China (7th–8th Century CE)',
    themeStyle: 'imperial',
    coverColor: '#7c2d12',
    accentColor: '#fbbf24',
    synopsis:
      'Discover Chang’an, the million-resident terminus of the Silk Road during China’s Tang Golden Age. Explore how Buddhist pilgrims, Sogdian caravan merchants, imperial reformers, astronomers, and poets forged an interconnected Eurasian world.',
    worldSetting: {
      locationName: 'Imperial Chang’an & The Western Market Plaza',
      atmosphereDescription:
        'Vermilion timber pavilions, glowing silk lanterns, upturned pagoda eaves, jade bridges, and caravan stalls brimming with Samarkand glass, spices, and Buddhist sutras.',
      skyColor: '#132a3e',
      horizonColor: '#d97706',
      groundColor: '#2d3a2e',
      plazaColor: '#a89f91'
    },
    chapters: [
      {
        number: 1,
        title: 'The Grid of One Million Souls: Chang’an',
        summary:
          'Designed on a strict cardinal grid of 108 walled wards, Tang Chang’an hosted diplomats, Nestorian Christians, Zoroastrians, Buddhists, and merchants from across Eurasia.',
        keyExcerpt:
          '“In the Western Market alone, two hundred twenty merchant guilds traded Persian brocades, Ferghana horses, Byzantine gold coins, and Indian medicines under imperial market inspectors.”'
      },
      {
        number: 2,
        title: 'Pilgrimage Across the Pamirs: Xuanzang',
        summary:
          'Defying an imperial travel ban in 629 CE, the monk Xuanzang journeyed 16 years through Central Asia and India to Nalanda, returning with 657 Sanskrit texts.',
        keyExcerpt:
          '“Across the Taklamakan Desert, where neither bird flies nor beast roams, one marks the way only by the bleached bones of previous caravans.” — Great Tang Records on the Western Regions'
      },
      {
        number: 3,
        title: 'Empress Wu Zetian & The Meritocratic State',
        summary:
          'Rising from concubine to the only female Emperor (Huangdi) in Chinese history, Wu Zetian expanded the civil service examination system to break aristocratic monopoly.',
        keyExcerpt:
          '“True talent lies not in the pedigree of the Great Clans of Shandong, but in the mastery of governance and literature tested in the imperial examination halls.”'
      },
      {
        number: 4,
        title: 'Stars, Woodblock Print & The Golden Age of Poetry',
        summary:
          'Tang scholars invented woodblock printing (producing the 868 CE Diamond Sutra), measured the terrestrial meridian under Yi Xing, and elevated classical shi poetry.',
        keyExcerpt:
          '“I raise my cup to invite the bright moon; with my shadow we become a party of three.” — Li Bai'
      }
    ],
    characters: [
      {
        id: 'xuanzang',
        name: 'Master Xuanzang',
        title: 'Buddhist Pilgrim, Translator & Geographer',
        faction: 'Great Wild Goose Pagoda Translation Academy',
        years: '602–664 CE',
        avatarStyle: {
          robeColor: '#d97706',
          cloakColor: '#991b1b',
          headgear: 'scholar_cap',
          prop: 'staff'
        },
        position: { x: -11, z: -8 },
        greeting:
          'Peace be upon your steps, traveler. For sixteen years I crossed the shifting sands of Lop Nor, the icy passes of the Pamirs, and the halls of Nalanda in India. What lands or teachings do you seek?',
        bio: 'Chinese Buddhist monk, scholar, and traveler whose 10,000-mile overland journey to India and back (629–645 CE) transformed East Asian philosophy and produced the Great Tang Records on the Western Regions, a primary geographical history of 110 Silk Road kingdoms.',
        personality:
          'Serene, observant, humble yet indomitably resolute, blending spiritual depth with keen geographical curiosity.',
        keyFacts: [
          'Traveled 16 years across Central Asia and India, studying at the great monastic university of Nalanda.',
          'Returned to Chang’an in 645 CE with 657 Sanskrit texts on 20 packhorses and led an imperial translation bureau.',
          'Dictated the Great Tang Records on the Western Regions (Da Tang Xiyuji) at Emperor Taizong’s request.',
          'Supervised the building of the Giant Wild Goose Pagoda in 652 CE to safeguard fireproof stone and palm-leaf sutras.'
        ],
        suggestedQuestions: [
          'How did you survive crossing the Taklamakan Desert and the Pamir Mountains?',
          'What was studying at Nalanda University in India like?',
          'Why did Emperor Taizong want you to write a geography book of the Western Regions?'
        ]
      },
      {
        id: 'wuzetian',
        name: 'Empress Wu Zetian',
        title: 'Sovereign Emperor (Huangdi) of the Zhou/Tang',
        faction: 'Imperial Court',
        years: '624–705 CE',
        avatarStyle: {
          robeColor: '#991b1b',
          cloakColor: '#eab308',
          headgear: 'crown',
          prop: 'scroll'
        },
        position: { x: 0, z: -15 },
        greeting:
          'You stand before the Dragon Throne. Let the old aristocratic clans murmur—I judge ministers by their mind and merit in the examination halls, not their ancestors’ tombs.',
        bio: 'The only woman in Chinese history to rule in her own right as Emperor (Huangdi), founding the Zhou interregnum (690–705 CE) within the Tang Dynasty. She championed the imperial civil service exams, promoted agriculture, stabilized the Silk Road garrison network, and patronized Buddhism.',
        personality:
          'Commanding, strategic, razor-sharp, reform-minded, and unafraid to challenge centuries of patriarchal orthodoxy.',
        keyFacts: [
          'Expanded the keju (imperial civil service examinations), allowing talented scholars from non-aristocratic families to reach high office.',
          'Issued the "Twelve Proposals" in 674 CE reducing corvée labor taxes and promoting sericulture and farming.',
          'Maintained Tang control over the Anxi Protectorate (Tarim Basin), keeping the Silk Road open.',
          'Left the famous "Wordless Stele" at the Qianling Mausoleum so future generations could judge her reign for themselves.'
        ],
        suggestedQuestions: [
          'How did expanding the civil service exams change who governed China?',
          'Why did you leave a blank "Wordless Stele" at your tomb?',
          'How did you use Buddhism and scholarship to legitimize your rule as female Emperor?'
        ]
      },
      {
        id: 'libai',
        name: 'Li Bai (Li Po)',
        title: 'The Banished Immortal of Poetry',
        faction: 'Hanlin Academy & Wandering Poets',
        years: '701–762 CE',
        avatarStyle: {
          robeColor: '#e2e8f0',
          cloakColor: '#0284c7',
          headgear: 'scholar_cap',
          prop: 'lantern'
        },
        position: { x: 11, z: -7 },
        greeting:
          'Aha! Another traveler beneath the Chang’an moon! Come, listen to the Sogdian lute players in the wine-shops while I compose a verse on the Yellow River!',
        bio: 'Born along the Central Asian frontier (likely Suyab), Li Bai became China’s most celebrated Romantic poet alongside his friend Du Fu. Summoned to the Hanlin Academy by Emperor Xuanzong, his free-spirited verse celebrated friendship, nature, Daoist transcendence, and frontier life.',
        personality:
          'Exuberant, lyrical, spontaneous, irreverent toward court pomp, and vividly imaginative.',
        keyFacts: [
          'Born in Central Asia (modern Kyrgyzstan) before growing up in Sichuan, reflecting the cosmopolitan reach of the Tang Empire.',
          'Served briefly as a court poet in the Hanlin Academy under Emperor Xuanzong before returning to a life of wandering.',
          'Mastered the yuefu and Regulated Verse styles, composing nearly 1,000 surviving poems.',
          'His lifelong friendship with Du Fu symbolizes the twin peaks of classical Chinese literature.'
        ],
        suggestedQuestions: [
          'How did growing up on the Central Asian frontier influence your poetry?',
          'Why did you leave the Emperor’s palace in Chang’an to wander the mountains and rivers?',
          'Can you share the story and meaning behind "Quiet Night Thought" or "Drinking Alone by Moonlight"?'
        ]
      },
      {
        id: 'kang',
        name: 'Sabao Kang (Sogdian Caravan Master)',
        title: 'Leader of the Samarkand Merchant Guild',
        faction: 'Western Market Caravan Network',
        years: 'Active c. 710–750 CE',
        avatarStyle: {
          robeColor: '#065f46',
          cloakColor: '#d97706',
          headgear: 'hood',
          prop: 'compass'
        },
        position: { x: -11, z: 10 },
        greeting:
          'Welcome to the Western Market! From Samarkand to Chang’an my camels carry bolts of damasked silk out and bring Roman glass, lapis lazuli, and golden peaches back!',
        bio: 'Representative of the Sogdian merchant diaspora from Transoxiana (modern Uzbekistan/Tajikistan) whose language served as the lingua franca of the overland Silk Road. Appointed by the Tang government as a Sabao (caravan and community leader).',
        personality:
          'Resourceful, multilingual, hospitable, and full of practical stories about desert oases, bills of exchange, and cultural exchange.',
        keyFacts: [
          'Sogdians from Samarkand and Bukhara formed the primary commercial network linking Persia, India, the Steppe, and Tang China.',
          'Tang Chang’an used "flying cash" (feiqian)—an early precursor to paper bills of credit—to settle long-distance trade.',
          'Introduced Central Asian music, the "Sogdian Whirl" dance, polo, and flatbreads into fashionable Tang urban culture.',
          'Held official status as Sabao to administer foreign merchant communities and Zoroastrian temples in Chinese cities.'
        ],
        suggestedQuestions: [
          'What goods are most valuable on the caravan route between Samarkand and Chang’an?',
          'How did "flying cash" credit notes work for merchants traveling thousands of miles?',
          'How did Central Asian music, food, and fashion become so popular in Chang’an?'
        ]
      },
      {
        id: 'yixing',
        name: 'Monk Yi Xing',
        title: 'Imperial Astronomer & Mechanical Engineer',
        faction: 'Astronomical Bureau',
        years: '683–727 CE',
        avatarStyle: {
          robeColor: '#312e81',
          cloakColor: '#fbbf24',
          headgear: 'scholar_cap',
          prop: 'compass'
        },
        position: { x: 11, z: 10 },
        greeting:
          'Observe this water-powered celestial globe! By measuring the sun’s shadow across thirteen stations from Vietnam to the northern steppe, we have calculated the curvature of the Earth!',
        bio: 'Tang Buddhist monk, mathematician, and astronomer who built the world’s first water-powered mechanical clock escapement (with engineer Liang Lingzan) and led the first state-sponsored meridian arc survey across 2,500 kilometers.',
        personality:
          'Precise, empirical, visionary, and eager to explain how Indian trigonometry and Chinese instrumentation combined in Tang science.',
        keyFacts: [
          'Directed a 2,500 km survey across 13 astronomical stations in 724–725 CE to measure one degree of terrestrial latitude.',
          'Constructed a water-driven bronze celestial sphere with an escapement mechanism that struck a bell every hour.',
          'Compiled the Dayan Calendar, integrating Indian sine tables into Chinese astronomical calculations.',
          'Demonstrated that solar eclipses appear differently depending on the observer’s geographic latitude.'
        ],
        suggestedQuestions: [
          'How did you measure the size of the Earth using shadow stations across Asia?',
          'How does your water-powered mechanical clock and celestial globe work?',
          'How did Indian mathematics and Chinese astronomy come together in your calendar?'
        ]
      }
    ],
    landmarks: [
      {
        id: 'wild_goose_pagoda',
        name: 'Giant Wild Goose Pagoda',
        type: 'pagoda',
        description:
          'Built in 652 CE in southern Chang’an to house the Sanskrit sutras and figurines brought back from India by Master Xuanzang.',
        x: 0,
        z: -24
      },
      {
        id: 'western_market',
        name: 'Western Market Archway',
        type: 'arch',
        description:
          'Cosmopolitan commercial hub of Chang’an containing 220 trade bazaars, banks, wine houses, and foreign caravanserais.',
        x: -19,
        z: -1
      },
      {
        id: 'celestial_pillar',
        name: 'Armillary & Gnomon Observatory',
        type: 'obelisk',
        description:
          'Bronze astronomical instruments used by Yi Xing and Liang Lingzan to chart stellar movements and reform the imperial calendar.',
        x: 19,
        z: -1
      },
      {
        id: 'jade_fountain',
        name: 'Qujiang Lotus Pavilion',
        type: 'fountain',
        description:
          'Imperial garden waterway where newly successful jinshi examination scholars celebrated with poetry banquets.',
        x: 0,
        z: 19
      }
    ]
  }
};

/**
 * Intelligent local textbook parser so that ANY uploaded textbook (.txt, .md, or extracted text)
 * immediately transforms into a custom 3D Book + 3D World + Historical Characters even offline
 * or before an API key is entered.
 */
export function parseCustomTextbookLocally(rawText, fileName = 'Uploaded Textbook') {
  const cleanTitle = fileName
    .replace(/\.(pdf|txt|md|docx?)$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const lines = (rawText || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Detect title from first heading or filename
  let detectedTitle = cleanTitle || 'Historical Chronicle';
  if (lines.length > 0 && lines[0].length < 90) {
    detectedTitle = lines[0].replace(/^#+\s*/, '');
  }

  // Detect era / theme keywords
  const lower = (rawText || '').toLowerCase();
  let themeStyle = 'classical';
  let era = 'Historical Era';
  let coverColor = '#2c3e50';
  let accentColor = '#e5b84b';
  let skyColor = '#1a2e40';
  let horizonColor = '#d48c56';
  let groundColor = '#364032';
  let plazaColor = '#bfb6a4';

  if (/revolution|bastille|constitution|parliament|industrial|republic|colony|17\d\d|18\d\d/.test(lower)) {
    themeStyle = 'revolution';
    era = 'Age of Revolutions & Modernity';
    coverColor = '#7f1d1d';
    skyColor = '#1e1b4b';
    horizonColor = '#b45309';
    groundColor = '#33353a';
    plazaColor = '#78716c';
  } else if (/dynasty|emperor|silk|pagoda|confuci|samurai|khan|asia|buddh/.test(lower)) {
    themeStyle = 'imperial';
    era = 'Imperial & Silk Road Era';
    coverColor = '#7c2d12';
    skyColor = '#132a3e';
    horizonColor = '#d97706';
    groundColor = '#2d3a2e';
    plazaColor = '#a89f91';
  }

  // Split text into chapters by headings (## Chapter...) or paragraphs
  const rawSections = (rawText || '')
    .split(/\n(?=#{1,3}\s+|Chapter\s+\d+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

  const paragraphs = (rawText || '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/^#+\s*.*$/gm, '').replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 40);

  const chapters = [];
  if (rawSections.length >= 2) {
    rawSections.slice(0, 6).forEach((sec, idx) => {
      const secLines = sec.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const heading = secLines[0].replace(/^#+\s*/, '').replace(/^Chapter\s+\d+:\s*/i, '');
      const body = secLines.slice(1).join(' ').trim() || secLines[0];
      if (body.length > 30) {
        chapters.push({
          number: chapters.length + 1,
          title: heading.slice(0, 68),
          summary: body.slice(0, 230) + (body.length > 230 ? '...' : ''),
          keyExcerpt: `“${body.slice(0, 280)}${body.length > 280 ? '...' : ''}”`
        });
      }
    });
  }

  if (chapters.length === 0) {
    const chunkCount = Math.min(4, Math.max(2, Math.ceil(paragraphs.length / 2)));
    for (let i = 0; i < chunkCount; i++) {
      const p = paragraphs[i] || lines.join(' ').slice(0, 350);
      chapters.push({
        number: i + 1,
        title: `Section ${i + 1}: ${p.split(/[.:!?]/)[0].slice(0, 52)}`,
        summary: p.slice(0, 220) + (p.length > 220 ? '...' : ''),
        keyExcerpt: `“${p.slice(0, 280)}${p.length > 280 ? '...' : ''}”`
      });
    }
  }

  // Extract capitalized multi-word proper names or titled figures from the text
  const nonPersonWords = new Set([
    'The', 'This', 'That', 'These', 'Those', 'In', 'On', 'At', 'By', 'For', 'With',
    'From', 'Into', 'During', 'After', 'Before', 'Under', 'Between', 'Chapter',
    'Section', 'Part', 'Book', 'History', 'University', 'Press', 'United', 'States',
    'North', 'South', 'East', 'West', 'First', 'Second', 'Third', 'World', 'War',
    'Ancient', 'Rome', 'Roman', 'Republic', 'Empire', 'Crisis', 'Agrarian', 'Following',
    'Mediterranean', 'Senate', 'Rubicon', 'River', 'Civil', 'Battle', 'Actium',
    'Ides', 'March', 'Triumvirate', 'Principate', 'Lex', 'Sempronia', 'Agraria',
    'Publica', 'Officiis', 'Thirteenth', 'Legion', 'Ptolemaic', 'Egypt', 'Century',
    'January', 'Brothers', 'Transformation', 'Defense', 'Mixed', 'Constitution'
  ]);

  const bodyOnlyText = (rawText || '').replace(/^#+\s+.*$/gm, '');
  const nameRegex = /\b(?:(?:King|Queen|Emperor|Empress|General|Tribune|Consul|Senator|Lord|Lady|Prince|Princess|Master|Dr\.|Professor|President|Sir|Saint|Pope|Sultan|Caliph|Admiral|Governor)\s+)?([A-Z][a-z]{2,}(?:\s+(?:of|de|da|von|al|ibn|the))?\s+[A-Z][a-z]{2,}(?:\s+(?:VII|III|II|IV|Jr\.|Younger|Elder|Great|[A-Z][a-z]{2,}))?)\b/g;
  const candidateCounts = new Map();
  let match;
  while ((match = nameRegex.exec(bodyOnlyText)) !== null) {
    const full = match[1].trim();
    const parts = full.split(/\s+/);
    if (parts.some((w) => nonPersonWords.has(w)) || full.length > 34) continue;
    candidateCounts.set(full, (candidateCounts.get(full) || 0) + 1);
  }

  const sortedNames = [...candidateCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((e) => e[0])
    .slice(0, 5);

  const fallbackArchetypes = [
    { name: 'The Chief Chronicler', title: 'Primary Historian of the Text', headgear: 'scholar_cap', prop: 'book' },
    { name: 'The Statesman & Reformer', title: 'Political Leader of the Era', headgear: 'laurel', prop: 'scroll' },
    { name: 'The Civic Philosopher', title: 'Thinker & Witness to History', headgear: 'hood', prop: 'staff' },
    { name: 'The Vanguard Commander', title: 'Strategist & Eyewitness', headgear: 'helmet', prop: 'sword' }
  ];

  const coords = [
    { x: -11, z: -8 },
    { x: 11, z: -8 },
    { x: -11, z: 9 },
    { x: 11, z: 9 },
    { x: 0, z: -15 }
  ];

  const palette = [
    { robe: '#1e3a8a', cloak: '#d97706', headgear: 'laurel', prop: 'scroll' },
    { robe: '#7c2d12', cloak: '#eab308', headgear: 'crown', prop: 'book' },
    { robe: '#065f46', cloak: '#f59e0b', headgear: 'scholar_cap', prop: 'staff' },
    { robe: '#4c1d95', cloak: '#dc2626', headgear: 'helmet', prop: 'sword' },
    { robe: '#1f2937', cloak: '#0284c7', headgear: 'tricorne', prop: 'compass' }
  ];

  const charList = (sortedNames.length >= 2 ? sortedNames : fallbackArchetypes.map((a) => a.name)).map(
    (charName, idx) => {
      // Find sentences mentioning this character
      const sentences = (rawText || '')
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.includes(charName.split(' ').pop()) && s.length > 35);

      const bioText =
        sentences.slice(0, 3).join(' ') ||
        paragraphs[idx % paragraphs.length] ||
        `Key historical figure featured in ${detectedTitle}.`;

      const style = palette[idx % palette.length];
      const pos = coords[idx % coords.length];

      return {
        id: `custom_char_${idx}`,
        name: charName,
        title: fallbackArchetypes[idx % fallbackArchetypes.length].title,
        faction: `${detectedTitle} Archive`,
        years: era,
        avatarStyle: {
          robeColor: style.robe,
          cloakColor: style.cloak,
          headgear: style.headgear,
          prop: style.prop
        },
        position: pos,
        greeting: `Greetings, scholar! You have opened "${detectedTitle}". Walk with me and let us examine the events recorded in these pages: ${bioText.slice(0, 140)}...`,
        bio: bioText.slice(0, 500),
        personality: 'Knowledgeable, articulate historical witness grounded directly in the uploaded textbook.',
        keyFacts: [
          sentences[0] ? sentences[0].slice(0, 180) : chapters[0].summary,
          sentences[1] ? sentences[1].slice(0, 180) : chapters[Math.min(1, chapters.length - 1)].summary,
          `Central figure in "${detectedTitle}" (${era}).`
        ],
        suggestedQuestions: [
          `What was your role in the events of ${detectedTitle}?`,
          'What were the most critical turning points described in this textbook?',
          'How did ordinary people experience these historical transformations?'
        ]
      };
    }
  );

  return {
    id: 'custom_' + Date.now(),
    title: detectedTitle,
    subtitle: `${era} • Interactive 3D Edition`,
    author: `Uploaded from ${fileName}`,
    era,
    themeStyle,
    coverColor,
    accentColor,
    synopsis: (paragraphs[0] || rawText || 'Interactive 3D visualization generated from your uploaded textbook.').slice(
      0,
      360
    ),
    worldSetting: {
      locationName: `${detectedTitle} Historical Sanctuary`,
      atmosphereDescription: `Interactive 3D reconstruction of ${detectedTitle}, featuring primary-source monuments and historical figures from your uploaded text.`,
      skyColor,
      horizonColor,
      groundColor,
      plazaColor
    },
    chapters,
    characters: charList,
    landmarks: [
      {
        id: 'custom_monument_1',
        name: `Grand Archive of ${detectedTitle.slice(0, 28)}`,
        type: 'temple',
        description: chapters[0]?.keyExcerpt || 'Central monument housing the primary records of the textbook.',
        x: 0,
        z: -23
      },
      {
        id: 'custom_monument_2',
        name: 'Stele of Chapter Chronicles',
        type: 'obelisk',
        description: chapters[Math.min(1, chapters.length - 1)]?.summary || 'Inscribed stele summarizing key events.',
        x: -18,
        z: -2
      },
      {
        id: 'custom_monument_3',
        name: 'Scholars’ Colonnade',
        type: 'arch',
        description: chapters[Math.min(2, chapters.length - 1)]?.summary || 'Walkway of historical debate and inquiry.',
        x: 18,
        z: -2
      },
      {
        id: 'custom_monument_4',
        name: 'Fountain of Primary Sources',
        type: 'fountain',
        description: 'A central gathering place for comparing perspectives across the textbook.',
        x: 0,
        z: 18
      }
    ]
  };
}

/**
 * Generates an in-character, textbook-grounded response locally when offline or when no API key is configured.
 */
export function generateContextualCharacterReply(character, book, userMessage) {
  const q = (userMessage || '').toLowerCase();
  const facts = character.keyFacts || [];
  const chapters = book.chapters || [];

  // Match relevant facts or chapters by keyword overlap
  const words = q
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let bestChapter = chapters[0];
  let bestScore = -1;
  for (const ch of chapters) {
    const hay = `${ch.title} ${ch.summary} ${ch.keyExcerpt}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (hay.includes(w)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      bestChapter = ch;
    }
  }

  let matchedFact = facts[0] || character.bio;
  for (const f of facts) {
    const fl = f.toLowerCase();
    if (words.some((w) => fl.includes(w))) {
      matchedFact = f;
      break;
    }
  }

  if (q.includes('who are you') || q.includes('introduce') || q.includes('your role') || q.includes('life')) {
    return `I am **${character.name}**, known in the annals of *${book.title}* as **${character.title}** (${character.years}).\n\n${character.bio}\n\nIn my time with the **${character.faction}**, one truth stood above all: *${matchedFact}* What aspect of my decisions would you like to weigh together?`;
  }

  if (q.includes('why') || q.includes('cause') || q.includes('reason') || q.includes('motive')) {
    return `You ask a question that goes to the very heart of our era (${book.era}). From my vantage point as **${character.title}**, nothing happened by mere chance.\n\nConsider what the chronicle records: *${matchedFact}* Furthermore, as detailed in **Chapter ${bestChapter?.number || 1} (${bestChapter?.title || 'our history'})**: ${bestChapter?.summary || ''}\n\n${bestChapter?.keyExcerpt || ''}\n\nIf you stood in my shoes amidst those pressures, would you have chosen differently?`;
  }

  return `That touches upon a pivotal chapter of *${book.title}*.\n\nAs I witnessed firsthand during ${character.years}: **${matchedFact}**\n\nIn **${bestChapter?.title || 'the textbook'}**, the chronicle notes:\n> ${bestChapter?.keyExcerpt || bestChapter?.summary}\n\n${character.bio.split('. ').slice(-2).join('. ')} Tell me—how do you judge our actions from your era?`;
}
