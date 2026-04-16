document.addEventListener('DOMContentLoaded', () => {
  // Hero Blobs trailing cursor
  const hero = document.getElementById('hero');
  const blob1 = document.querySelector('.blob-1');
  const blob2 = document.querySelector('.blob-2');
  const blob3 = document.querySelector('.blob-3');

  if (hero && blob1 && blob2 && blob3) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;

    // Blob positions init
    let b1X = mouseX, b1Y = mouseY;
    let b2X = mouseX, b2Y = mouseY;
    let b3X = mouseX, b3Y = mouseY;

    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    });

    function animateBlobs() {
      // Lerp for smooth trailing effect
      b1X += (mouseX - b1X) * 0.15;
      b1Y += (mouseY - b1Y) * 0.15;

      b2X += (mouseX - b2X) * 0.08;
      b2Y += (mouseY - b2Y) * 0.08;

      b3X += (mouseX - b3X) * 0.04;
      b3Y += (mouseY - b3Y) * 0.04;

      blob1.style.transform = `translate(calc(-50% + ${b1X}px), calc(-50% + ${b1Y}px))`;
      blob2.style.transform = `translate(calc(-50% + ${b2X}px), calc(-50% + ${b2Y}px))`;
      blob3.style.transform = `translate(calc(-50% + ${b3X}px), calc(-50% + ${b3Y}px))`;

      requestAnimationFrame(animateBlobs);
    }

    animateBlobs();
  }

  // Continue to Resume Button logic
  const continueBtn = document.getElementById('continue-btn');
  if (continueBtn) {
    continueBtn.addEventListener('click', (e) => {
      e.preventDefault();

      // Add collapsed class to hero, letting CSS handle the visual pull-up.
      // No forced scrolling logic needed.
      hero.classList.add('collapsed');
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Optional: ensures they anchor to the true top as it shrinks
    });
  }

  // Modals Logic for Education & Experience
  const modalOverlay = document.getElementById('modal-overlay');
  const modalBody = document.getElementById('modal-body');
  const closeBtn = document.querySelector('.close-btn');

  // Modal data mapping
  const modalData = {
    'byu-education': {
      title: 'Brigham Young University',
      content: `
        <div class="modal-images">
          <img src="assets/photos/BYUlibrary.jpg" alt="BYU Library">
        </div>
        <p>"Attending Brigham Young University has been a long-term goal for me, and being here has exceeded my expectations. The faculty, academic culture, and campus environment motivate me to work hard and grow every semester. As a pre-accounting student applying to the Accounting program in Fall 2026, I’ve become particularly interested in managerial accounting and the way it shapes strategy, operations, and decision-making within organizations.</p>
        <h4>Relevant Coursework</h4>
        <ul>
          <li>ACC 200 — Principles of Accounting</li>
          <li>ACC 310 — Intermediate Financial Accounting</li>
          <li>IS 110 — Spreadsheet Skills & Business Analysis</li>
          <li>IS 201 — Information Systems</li>
          <li>MKTG 201 — Marketing Management</li>
        </ul>
        <p>Once I complete my bachelor’s degree, I plan to apply to graduate school to deepen my expertise in accounting and prepare for advanced professional opportunities."</p>
      `
    },
    'exp-bear-river': {
      title: 'Bear River Music',
      content: `
        <div class="modal-images">
          <img src="assets/photos/Seal.png" alt="Piano Technician Certification">
          <img src="assets/photos/Repair.jpg" alt="Tuning a piano">
        </div>
        <p>I started Bear River Music in the fall of 2024 when I realized there was a real need for dependable piano tuning in the Idaho Falls area. Choosing to build a business instead of taking a traditional job path was a risk, but one that aligned with my long-term goals. After completing my certification through the Piano Technician Academy, I began growing the business from scratch and quickly developed a steady client base through quality work and word-of-mouth referrals.</p>
        <h4>Business Responsibilities & Transferable Skills</h4>
        <p>Beyond just tuning pianos, these are some of the core skills I use to run and grow Bear River Music:</p>
        <ul>
          <li><strong>Bookkeeping & Record-Keeping</strong> — maintaining accurate financial records, tracking revenue and expenses, and organizing service history</li>
          <li><strong>Customer Relations</strong> — communicating clearly with clients, answering questions, and ensuring every family feels confident and cared for</li>
          <li><strong>Marketing & Outreach</strong> — promoting services through direct sales, referrals, and community engagement</li>
          <li><strong>Scheduling & Time Management</strong> — coordinating appointments efficiently and managing a growing client base</li>
          <li><strong>Workflow Automation</strong> — using Microsoft Excel to streamline processes, automate tracking, and improve operational efficiency</li>
        </ul>
        <p>One of the biggest challenges in starting a home-service business like Bear River Music was building a customer base from scratch. I jumpstarted this process through direct outreach, asking for referrals, and making sure every family I worked with felt genuinely taken care of. This focus on quality service and positive client experiences led to steady momentum, and I’ve seen my sales double each quarter, culminating in a strong winter season. Today, Bear River Music is becoming one of the most trusted piano-service companies in the Idaho Falls area, driven almost entirely by word-of-mouth and repeat clients.</p>
      `
    },
    'exp-greenix': {
      title: 'Greenix Pest Control',
      content: `
        <div class="modal-images">
          <img src="assets/photos/gnxTrent.png" alt="Working at Greenix">
        </div>
        <p>I worked as a Pest Control Service Professional with Greenix, where I was responsible for providing high-quality home-service treatments and maintaining strong customer relationships. The role required professionalism, clear communication, and the ability to adapt quickly in a fast-paced, client-focused environment.</p>
        <h4>Responsibilities & Transferable Skills</h4>
        <ul>
          <li><strong>Customer Communication</strong> — explaining treatment plans, answering questions, and ensuring homeowners felt confident and informed</li>
          <li><strong>Route & Time Management</strong> — organizing daily schedules efficiently while meeting service expectations</li>
          <li><strong>Problem-Solving</strong> — diagnosing pest issues and determining the most effective treatment approach</li>
          <li><strong>Safety & Compliance</strong> — following strict safety protocols and product guidelines</li>
          <li><strong>Physical & Outdoor Work</strong> — performing hands-on service in varying weather and home conditions</li>
          <li><strong>Professionalism in Home-Service Settings</strong> — representing the company with integrity and respect in every interaction</li>
        </ul>
      `
    },
    'exp-agriwest': {
      title: 'Agriwest & Idaho Sod Inc.',
      content: `
        <div class="modal-images">
          <img src="assets/photos/Tractor.jpg" alt="Tractor in field">
          <img src="assets/photos/hey.jpg" alt="Working in the field">
        </div>
        <p>Throughout high school I worked for AgriWest and Idaho Sod, two sister companies in the Idaho Falls area. This job gave me hands-on experience operating large agricultural equipment, performing demanding physical labor, and working long days in varying weather conditions. The most valuable part of this experience was learning how to work hard, stay reliable, and problem-solve in real time when equipment or field conditions changed unexpectedly.</p>
        <h4>Relevant Skills & Competencies</h4>
        <ul>
          <li><strong>Hard Work & Commitment</strong> — consistently worked long days while keeping quality high, proving a dedication to the job.</li>
          <li><strong>Stamina & Physical Labor</strong> — effectively performed in highly demanding, labor-intensive environments and varying weather conditions.</li>
          <li><strong>Troubleshooting & Mechanics</strong> — diagnosed, repaired, and maintained complex agricultural machinery on the fly to prevent operational delays.</li>
          <li><strong>Versatile Work Ethic</strong> — seamlessly transitioned between relying on small teams to accomplish large-scale objectives, and functioning with complete autonomy on solo tasks.</li>
        </ul>
      `
    }
  };

  const openModal = (id) => {
    if (modalData[id]) {
      modalBody.innerHTML = modalData[id].content;
      modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    }
  };

  const closeModal = () => {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = ''; // Restore scrolling
    // Clear out after animation
    setTimeout(() => {
      modalBody.innerHTML = '';
    }, 300);
  };

  document.querySelectorAll('.open-modal').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-modal-id');
      openModal(modalId);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // Skills & Volunteer Accordions
  document.querySelectorAll('.skill-card, .volunteer-card').forEach(card => {
    card.addEventListener('click', () => {
      // Toggle current
      card.classList.toggle('active');
    });
  });
});
