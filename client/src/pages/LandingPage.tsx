import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

const ASCII_CHARS = " .:=+*xX#%Q0369B&";
const ASCII_COLUMNS = 60;
const ASCII_COLOR = '#bcdcff';

export default function LandingPage() {
  const navigate = useNavigate();
  const { setDemoMode } = useStore();
  const pageRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const handleDemo = () => {
    setDemoMode(true);
    navigate('/');
  };

  const scrollToFeatures = () => {
    const features = pageRef.current?.querySelector('.features');
    if (features) lenisRef.current?.scrollTo(features as HTMLElement, { offset: -70, duration: 1.2 });
  };

  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    let cancelled = false;
    let introCtx: gsap.Context | null = null;
    const splits: SplitText[] = [];
    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;

    lenis = new Lenis({ lerp: 0.11, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    raf = (time: number) => lenis!.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const navEl = page.querySelector('nav');
    const onScroll = () => navEl?.classList.toggle('nav--scrolled', lenis!.scroll > 60);
    lenis.on('scroll', onScroll);
    onScroll();

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.stat-number').forEach((el) => {
        const text = el.textContent ?? '';
        const match = text.match(/^([^0-9.]*)([\d.]+)(.*)$/);
        if (!match) return;
        const [, prefix, numStr, suffix] = match;
        const target = parseFloat(numStr);
        const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0;
        const counter = { val: 0 };
        gsap.to(counter, {
          val: target,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => {
            el.textContent = `${prefix}${counter.val.toFixed(decimals)}${suffix}`;
          },
        });
      });

      const fhSplit = new SplitText('.features-header h2', {
        type: 'lines,words',
        wordsClass: 'reveal-word',
        mask: 'words',
      });
      gsap.from(fhSplit.words, {
        yPercent: 110,
        duration: 0.7,
        stagger: 0.035,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.features-header', start: 'top 80%', once: true },
      });
      gsap.from('.features-header p', {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.features-header', start: 'top 75%', once: true },
      });

      gsap.set('.feature-card', { y: 48, opacity: 0 });
      ScrollTrigger.batch('.feature-card', {
        start: 'top 88%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            y: 0,
            opacity: 1,
            duration: 0.7,
            stagger: 0.1,
            ease: 'power3.out',
            clearProps: 'transform',
          }),
      });

      const ctaSplit = new SplitText('.cta-content h2', {
        type: 'lines',
        linesClass: 'cta-line',
        mask: 'lines',
      });
      gsap.from(ctaSplit.lines, {
        yPercent: 110,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.cta', start: 'top 75%', once: true },
      });
      gsap.from('.cta-content p', {
        y: 20,
        opacity: 0,
        duration: 0.7,
        delay: 0.3,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.cta', start: 'top 70%', once: true },
      });
      gsap.from('.cta-content .btn-large', {
        y: 20,
        opacity: 0,
        duration: 0.7,
        delay: 0.45,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.cta', start: 'top 70%', once: true },
      });
    }, page);

    const buildAscii = (image: HTMLImageElement) => {
      const rows = Math.round(ASCII_COLUMNS / (image.naturalWidth / image.naturalHeight));

      const sampler = document.createElement('canvas');
      sampler.width = ASCII_COLUMNS;
      sampler.height = rows;
      const context = sampler.getContext('2d')!;
      context.drawImage(image, 0, 0, ASCII_COLUMNS, rows);
      const pixels = context.getImageData(0, 0, ASCII_COLUMNS, rows).data;

      const grid = document.createElement('div');
      grid.className = 'ascii-grid';
      grid.style.gridTemplateColumns = `repeat(${Math.ceil(ASCII_COLUMNS / 3)}, 1fr)`;
      grid.style.gridTemplateRows = `repeat(${Math.ceil(rows / 3)}, 1fr)`;
      grid.style.color = ASCII_COLOR;

      const typingCells: Array<{ span: HTMLSpanElement; char: string; charIndex: number }> = [];

      for (let groupRow = 0; groupRow < rows; groupRow += 3) {
        for (let groupCol = 0; groupCol < ASCII_COLUMNS; groupCol += 3) {
          const group = document.createElement('div');
          const groupHeight = Math.min(3, rows - groupRow);
          const groupWidth = Math.min(3, ASCII_COLUMNS - groupCol);
          const fragment = document.createDocumentFragment();

          group.className = 'ascii-group';
          group.style.gridTemplateColumns = `repeat(${groupWidth}, 1fr)`;
          group.style.gridTemplateRows = `repeat(${groupHeight}, 1fr)`;

          for (let row = groupRow; row < groupRow + groupHeight; row++) {
            for (let col = groupCol; col < groupCol + groupWidth; col++) {
              const offset = (row * ASCII_COLUMNS + col) * 4;
              const brightness =
                (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
              const visible = brightness >= 0.1;

              const charIndex = Math.floor(brightness * (ASCII_CHARS.length - 1));
              const char = ASCII_CHARS[charIndex];

              const span = document.createElement('span');
              span.className = 'ascii-char';
              span.textContent = ' ';
              span.style.opacity = visible ? Math.max(0.45, Math.pow(brightness, 0.65)).toString() : '0';
              if (visible) typingCells.push({ span, char, charIndex });
              fragment.appendChild(span);
            }
          }

          group.appendChild(fragment);
          grid.appendChild(group);
        }
      }

      for (let index = typingCells.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [typingCells[index], typingCells[randomIndex]] = [typingCells[randomIndex], typingCells[index]];
      }

      image.closest('.hero-img')?.appendChild(grid);
      return typingCells;
    };

    const initIntro = async () => {
      const heroImg = page.querySelector('.hero-media .hero-img img') as HTMLImageElement | null;
      if (!heroImg) return;

      await (heroImg.complete && heroImg.naturalWidth
        ? Promise.resolve()
        : new Promise<void>((resolve) => heroImg.addEventListener('load', () => resolve(), { once: true })));
      if (cancelled) return;

      const typingCells = buildAscii(heroImg);

      introCtx = gsap.context(() => {
        splits.push(new SplitText('.preloader-copy p', { type: 'chars', charsClass: 'char' }));
        splits.push(new SplitText('.hero-footer p', { type: 'words', wordsClass: 'word', mask: 'words' }));
        const heroSplit = new SplitText('.hero-copy h1', { type: 'lines', linesClass: 'block-line' });
        splits.push(heroSplit);

        const heroLines: HTMLElement[] = heroSplit.lines as HTMLElement[];
        const heroReveals: Array<{ orange: HTMLDivElement; white: HTMLDivElement }> = [];

        heroLines.forEach((line: HTMLElement) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'block-line-wrapper';
          line.parentNode!.insertBefore(wrapper, line);
          wrapper.appendChild(line);

          const white = document.createElement('div');
          white.className = 'block-revealer block-white';
          wrapper.appendChild(white);

          const orange = document.createElement('div');
          orange.className = 'block-revealer block-orange';
          wrapper.appendChild(orange);

          heroReveals.push({ orange, white });
        });

        const revealBlocks = heroReveals.flatMap((reveal) => [reveal.orange, reveal.white]);

        gsap.set(heroLines, { opacity: 0 });
        gsap.set(revealBlocks, { scaleX: 0, transformOrigin: 'left center' });

        const preloaderBlocks = Array.from(page.querySelectorAll<HTMLElement>('.preloader-block'));
        const nestedBlocks = preloaderBlocks.slice(1);

        gsap.set(nestedBlocks, {
          x: -18,
          rotation: -100,
          opacity: 0,
          transformOrigin: 'left center',
        });

        const tl = gsap.timeline({ delay: 1 });

        tl.to('.char', { opacity: 1, duration: 0.15, stagger: 0.1 });

        tl.to(
          '.preloader',
          { scale: 1, duration: 0.35, ease: 'back.out(1.8)', transformOrigin: '25% center' },
          '<'
        );

        tl.to(
          nestedBlocks,
          {
            delay: 0.25,
            x: 0,
            rotation: 0,
            opacity: 1,
            duration: 0.65,
            ease: 'power3.inOut',
            stagger: 0.35,
          },
          '<'
        );

        tl.to(['.preloader-copy', '.preloader-block'], { opacity: 0, duration: 0.5 });

        tl.to('.preloader-overlay', { '--wipe': '90deg', duration: 1, ease: 'power3.inOut' });

        tl.set('.preloader-overlay', { pointerEvents: 'none' });

        tl.to('nav', { y: '0', duration: 1, ease: 'power3.out' }, '-=0.65');

        heroReveals.forEach((reveal, index) => {
          const line = heroLines[index];
          const position = index === 0 ? '-=0.65' : '-=0.75';

          const lineTl = gsap.timeline();

          [reveal.orange, reveal.white].forEach((block, blockIndex) => {
            const blockTl = gsap.timeline({ delay: blockIndex * 0.15 });

            blockTl.to(block, { scaleX: 1, duration: 0.5, ease: 'power4.inOut' });
            blockTl.set(block, { transformOrigin: 'right center' });
            blockTl.to(block, { scaleX: 0, duration: 0.5, ease: 'power4.inOut' });

            lineTl.add(blockTl, 0);
          });

          lineTl.set(line, { opacity: 1 }, 0.5);

          tl.add(lineTl, position);
        });

        tl.to(
          '.hero-copy .btn',
          { y: '0px', opacity: 1, duration: 1, ease: 'power3.out' },
          '-=0.5'
        );

        tl.to(
          '.hero-footer p .word',
          { y: '0%', duration: 0.75, stagger: 0.075, ease: 'power3.out' },
          '-=0.85'
        );

        let asciiTypedCount = 0;
        const asciiTypewriter = { count: 0 };

        tl.to(
          asciiTypewriter,
          {
            count: typingCells.length,
            duration: 2.5,
            ease: 'none',
            onUpdate: () => {
              const nextCount = Math.floor(asciiTypewriter.count);
              while (asciiTypedCount < nextCount) {
                const cell = typingCells[asciiTypedCount];
                cell.span.textContent = cell.char;
                asciiTypedCount++;
              }
            },
          },
          '-=2.5'
        );

        const startRandomTyping = () => {
          const refreshSymbols = () => {
            for (let count = 0; count < 6; count++) {
              const cell = typingCells[Math.floor(Math.random() * typingCells.length)];
              const variation = Math.floor(Math.random() * 5) - 2;
              const charIndex = Math.max(1, Math.min(ASCII_CHARS.length - 1, cell.charIndex + variation));
              cell.span.textContent = ASCII_CHARS[charIndex];
            }
            gsap.delayedCall(0.12, refreshSymbols);
          };
          refreshSymbols();
        };

        tl.call(startRandomTyping);
      }, page);
    };

    initIntro();

    document.fonts?.ready.then(() => {
      if (!cancelled) ScrollTrigger.refresh();
    });

    return () => {
      cancelled = true;
      introCtx?.revert();
      splits.forEach((s) => s.revert());
      ctx.revert();
      if (raf) gsap.ticker.remove(raf);
      lenis?.destroy();
      lenisRef.current = null;
    };
  }, []);

  return (
    <div ref={pageRef} className="landing-page">
      <div className="preloader-overlay">
        <div className="preloader">
          <div className="preloader-block"></div>
          <div className="preloader-block"></div>
          <div className="preloader-block"></div>
          <div className="preloader-block"></div>
        </div>
        <div className="preloader-copy">
          <p>Loading...</p>
        </div>
      </div>

      <nav>
        <div className="nav-logo">
          <a href="#" aria-label="Allawii home" onClick={(e) => { e.preventDefault(); lenisRef.current?.scrollTo(0, { duration: 1.2 }); }}>
            <img src="/brand/allawii-symbol.png" alt="" className="nav-logo-mark" />
            ALLAWII
          </a>
        </div>
        <div className="nav-toggler">
          <button onClick={scrollToFeatures} className="btn">Menu</button>
        </div>
        <div className="nav-cta">
          <button onClick={() => navigate('/login')} className="btn btn-ghost">Log in</button>
          <button onClick={() => navigate('/signup')} className="btn">Sign up</button>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <h1>Make your allowance go further, smarter.</h1>
          <button onClick={() => navigate('/signup')} className="btn">Start saving today</button>
        </div>
        <div className="hero-media">
          <div className="hero-img">
            <img src="/assets/Mona_Lisa.jpg" alt="" />
          </div>
        </div>
        <div className="hero-footer">
          <p>Built for students who want financial freedom.</p>
        </div>
      </section>

      <section className="stats">
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-number">₦2.5M+</div>
            <div className="stat-label">Saved by students</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">10K+</div>
            <div className="stat-label">Active users</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">50K+</div>
            <div className="stat-label">Expenses tracked</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">4.9★</div>
            <div className="stat-label">User rating</div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="features-header">
          <h2>Everything you need to master your money</h2>
          <p>Smart tools designed for student life</p>
        </div>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3>Safe-to-Spend</h3>
            <p>Know exactly what you can spend without breaking your budget. Real-time tracking that keeps you in control.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18M9 21V9" />
              </svg>
            </div>
            <h3>Smart Budgets</h3>
            <p>Create budgets that actually work. Flexible categories that adapt to your spending patterns and goals.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0h2m-2 0h-5m-9 0H3m3 0h6M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5" />
              </svg>
            </div>
            <h3>Savings Goals</h3>
            <p>Set goals and watch your savings grow. Track progress and celebrate milestones along the way.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
            <h3>B Moni Wallet</h3>
            <p>Integrated virtual wallet for seamless transactions. Manage your money all in one place.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8V4H8" />
                <rect x="4" y="8" width="16" height="12" rx="2" />
                <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
              </svg>
            </div>
            <h3>AI Coach</h3>
            <p>Get personalized financial advice powered by AI. Learn better money habits with guidance that fits your life.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Group Expenses</h3>
            <p>Split bills with friends easily. Track shared expenses and settle up without the awkward conversations.</p>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="cta-content">
          <h2>Ready to take control of your finances?</h2>
          <p>Join thousands of students already saving smarter with Allawii</p>
          <button onClick={() => navigate('/signup')} className="btn btn-large">Sign up for free</button>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <h3><img src="/brand/allawii-symbol.png" alt="" className="footer-logo-mark" /> ALLAWII</h3>
            <p>Your student finance companion</p>
          </div>
          <div className="footer-links">
            <div className="footer-column">
              <h4>Product</h4>
              <a href="#features" onClick={(e) => { e.preventDefault(); scrollToFeatures(); }}>Features</a>
              <a href="#">Security</a>
              <a href="#">Pricing</a>
            </div>
            <div className="footer-column">
              <h4>Company</h4>
              <a href="#">About</a>
              <a href="#">Blog</a>
              <a href="#">Careers</a>
            </div>
            <div className="footer-column">
              <h4>Support</h4>
              <a href="#">Help Center</a>
              <a href="#">Contact</a>
              <a href="#">Privacy</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 Allawii. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
