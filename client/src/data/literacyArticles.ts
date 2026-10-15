export type LiteracyBlock =
  | { type: 'p' | 'h' | 'strong'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; rows: string[][] };

export interface LiteracyArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  blocks: LiteracyBlock[];
}

export const LITERACY_ARTICLES: LiteracyArticle[] = [
  {
    "id": "1",
    "title": "Budgeting 101: Give Every Naira a Purpose",
    "description": "Give every naira a purpose with a plan that survives real student life.",
    "category": "budgeting",
    "duration": 5,
    "blocks": [
      {
        "type": "p",
        "text": "A budget isn't about restricting yourself from enjoying life. It's about knowing where your money needs to go before you spend it."
      },
      {
        "type": "p",
        "text": "Whether you receive a monthly allowance, weekly support from your parents, or income from a side hustle, having a plan can help you make your money last longer and reduce financial stress."
      },
      {
        "type": "p",
        "text": "Let's break it down."
      },
      {
        "type": "h",
        "text": "What Is Budgeting?"
      },
      {
        "type": "p",
        "text": "Budgeting is the process of planning how you'll use the money you have."
      },
      {
        "type": "p",
        "text": "It helps you answer three important questions:"
      },
      {
        "type": "list",
        "items": [
          "How much money do I have?",
          "What do I need to spend it on?",
          "How much can I save or spend on things I enjoy?"
        ]
      },
      {
        "type": "p",
        "text": "Without a budget, it's easy to spend money on several small purchases and realize too late that you've run out of money for something important."
      },
      {
        "type": "strong",
        "text": "The goal isn't to spend as little as possible. It's to spend intentionally."
      },
      {
        "type": "h",
        "text": "Step 1: Know How Much Money You Have"
      },
      {
        "type": "p",
        "text": "Before creating a budget, calculate the money you can realistically work with."
      },
      {
        "type": "p",
        "text": "This might include:"
      },
      {
        "type": "list",
        "items": [
          "Your allowance.",
          "Income from a part-time job or side hustle.",
          "Money you've received from other sources."
        ]
      },
      {
        "type": "p",
        "text": "For example, imagine you receive ₦40,000 as your monthly allowance."
      },
      {
        "type": "p",
        "text": "That's your starting point. However, if you already have outstanding expenses or financial commitments, you'll need to account for those too."
      },
      {
        "type": "h",
        "text": "Step 2: Identify Your Expenses"
      },
      {
        "type": "p",
        "text": "Think about the things you regularly spend money on."
      },
      {
        "type": "p",
        "text": "As a student, your expenses might include:"
      },
      {
        "type": "list",
        "items": [
          "Food: Meals, groceries and snacks.",
          "Transportation: Bus fares, fuel or other transport costs.",
          "Data: Internet subscriptions and airtime.",
          "Academics: Textbooks, printing, stationery and school materials.",
          "Personal expenses: Toiletries, clothing and personal care.",
          "Entertainment: Outings, subscriptions and activities with friends."
        ]
      },
      {
        "type": "p",
        "text": "Don't forget occasional expenses. An academic payment or an unexpected transport cost can disrupt your budget if you don't plan for it."
      },
      {
        "type": "h",
        "text": "Step 3: Give Your Money a Plan"
      },
      {
        "type": "p",
        "text": "Now that you know your income and expenses, decide how much to allocate to each category."
      },
      {
        "type": "p",
        "text": "Let's use a hypothetical monthly allowance of ₦40,000."
      },
      {
        "type": "table",
        "rows": [
          [
            "Category",
            "Planned Amount"
          ],
          [
            "Food",
            "₦15,000"
          ],
          [
            "Transportation",
            "₦6,000"
          ],
          [
            "Data & Airtime",
            "₦3,000"
          ],
          [
            "Academic Expenses",
            "₦4,000"
          ],
          [
            "Personal & Entertainment",
            "₦5,000"
          ],
          [
            "Savings",
            "₦4,000"
          ],
          [
            "Emergency Buffer",
            "₦3,000"
          ],
          [
            "Total",
            "₦40,000"
          ]
        ]
      },
      {
        "type": "p",
        "text": "This is only an example. Your actual allocation should reflect your needs, location, living arrangements and financial circumstances."
      },
      {
        "type": "p",
        "text": "Notice that every naira has a purpose. You know what you're working with, what needs to be covered and what you've set aside for the future."
      },
      {
        "type": "p",
        "text": "You don't have to use these exact categories or amounts. Your budget should work for your life."
      },
      {
        "type": "h",
        "text": "Step 4: Track What You Actually Spend"
      },
      {
        "type": "p",
        "text": "Creating a budget is only the beginning. You also need to track your spending."
      },
      {
        "type": "p",
        "text": "Suppose you allocate ₦15,000 for food but spend ₦9,000 in the first week. You now know that you may need to adjust your spending for the remaining weeks."
      },
      {
        "type": "p",
        "text": "Tracking helps you identify the difference between what you planned to spend and what you actually spent."
      },
      {
        "type": "p",
        "text": "You can record transactions manually, keep receipts or use a budgeting app like Allawii to organize your expenses."
      },
      {
        "type": "p",
        "text": "Over time, you'll begin to recognize your spending patterns and make more informed decisions."
      },
      {
        "type": "h",
        "text": "Step 5: Adjust When Life Happens"
      },
      {
        "type": "p",
        "text": "Sometimes, things won't go according to plan."
      },
      {
        "type": "p",
        "text": "Perhaps transportation costs more than you expected, or you need to purchase an academic material you hadn't budgeted for."
      },
      {
        "type": "p",
        "text": "Does that mean your budget has failed?"
      },
      {
        "type": "strong",
        "text": "Not at all. A good budget should be flexible enough to adapt to real life."
      },
      {
        "type": "p",
        "text": "Review your remaining money, account for your essential expenses and decide where adjustments are possible."
      },
      {
        "type": "p",
        "text": "You might temporarily reduce your entertainment budget or adjust a savings contribution if necessary."
      },
      {
        "type": "p",
        "text": "However, avoid automatically sacrificing essential needs just to maintain an unrealistic budget."
      },
      {
        "type": "p",
        "text": "The goal is to recover and move forward, not to abandon your financial plan because one week didn't go as expected."
      },
      {
        "type": "h",
        "text": "Step 6: Make Saving Part of Your Plan"
      },
      {
        "type": "p",
        "text": "If your finances allow it, include savings in your budget instead of relying entirely on whatever money remains at the end of the month."
      },
      {
        "type": "p",
        "text": "You could save towards:"
      },
      {
        "type": "list",
        "items": [
          "Buying a laptop.",
          "Paying for a course or certification.",
          "Building an emergency fund.",
          "Starting a small business.",
          "Purchasing something you've wanted for a while."
        ]
      },
      {
        "type": "p",
        "text": "Your savings target should be realistic. If your current allowance barely covers your essential expenses, it's okay to focus on those needs first."
      },
      {
        "type": "p",
        "text": "Remember, financial progress isn't measured by how much you save compared with someone else."
      },
      {
        "type": "p",
        "text": "It's about making decisions that support your own circumstances and goals."
      },
      {
        "type": "h",
        "text": "Common Budgeting Mistakes to Avoid"
      },
      {
        "type": "p",
        "text": "1. Forgetting small expenses. Snacks, airtime and other small purchases can add up over time."
      },
      {
        "type": "p",
        "text": "2. Making an unrealistic budget. If your allocations don't reflect your actual needs, you'll struggle to follow them."
      },
      {
        "type": "p",
        "text": "3. Ignoring occasional expenses. Plan for predictable costs that don't occur every week."
      },
      {
        "type": "p",
        "text": "4. Treating your entire balance as spendable money. Some of your money may already be needed for upcoming expenses."
      },
      {
        "type": "p",
        "text": "5. Giving up after overspending. One mistake doesn't mean your entire plan is ruined. Review your situation and adjust."
      },
      {
        "type": "p",
        "text": "6. Comparing your budget with someone else's. Students have different allowances, responsibilities and living expenses. What works for another person may not work for you."
      },
      {
        "type": "h",
        "text": "Your Budgeting Checklist"
      },
      {
        "type": "p",
        "text": "Before you finish, ask yourself:"
      },
      {
        "type": "list",
        "items": [
          "Do I know how much money I currently have?",
          "Have I identified my essential expenses?",
          "Have I planned for upcoming payments?",
          "Do I know how much I can comfortably spend?",
          "Have I considered saving, if my circumstances allow?",
          "Do I have a plan for reviewing my spending?"
        ]
      },
      {
        "type": "p",
        "text": "You don't need to have everything figured out immediately. Start with what you know and improve your budget as you learn more about your spending habits."
      },
      {
        "type": "h",
        "text": "The Takeaway"
      },
      {
        "type": "p",
        "text": "Budgeting isn't about telling yourself no to everything. It's about understanding your priorities, making informed decisions and giving yourself more control over your money."
      },
      {
        "type": "p",
        "text": "The more you understand your spending, the easier it becomes to decide what you can afford, what needs to change and what you're working towards."
      },
      {
        "type": "h",
        "text": "Ready to put this into practice?"
      },
      {
        "type": "p",
        "text": "Open Allawii’s Allowance Manager to enter your allowance, plan your expenses and create a budget that works for you."
      },
      {
        "type": "p",
        "text": "Your money. Your priorities. Your plan."
      }
    ]
  },
  {
    "id": "2",
    "title": "Needs vs Wants: What Should Come First?",
    "description": "Decide what to pay for first without giving up everything you enjoy.",
    "category": "spending",
    "duration": 4,
    "blocks": [
      {
        "type": "p",
        "text": "Have you ever bought something you really wanted, only to realise later that you needed the money for something more important?"
      },
      {
        "type": "p",
        "text": "It happens. Sometimes, spending decisions feel small in the moment, but they can affect how much money you have left for the rest of the week."
      },
      {
        "type": "p",
        "text": "Learning to distinguish between needs and wants can help you make better financial decisions without giving up everything you enjoy."
      },
      {
        "type": "p",
        "text": "Let's break it down."
      },
      {
        "type": "h",
        "text": "What Are Needs?"
      },
      {
        "type": "p",
        "text": "Needs are things essential to your well-being, daily life, or responsibilities."
      },
      {
        "type": "p",
        "text": "As a university student, your needs might include:"
      },
      {
        "type": "list",
        "items": [
          "Food: Meals and groceries to keep you healthy.",
          "Transportation: Money to get to lectures or other essential destinations.",
          "Academic expenses: Required textbooks, printing, and learning materials.",
          "Data and airtime: When needed for communication, research, and coursework.",
          "Personal care: Toiletries and other basic necessities."
        ]
      },
      {
        "type": "p",
        "text": "These expenses deserve priority because neglecting them can affect your daily life, health, or education."
      },
      {
        "type": "p",
        "text": "However, needs differ from person to person. Something essential for one student may be optional for another, depending on their circumstances."
      },
      {
        "type": "h",
        "text": "What Are Wants?"
      },
      {
        "type": "p",
        "text": "Wants are things you'd like to have but can usually postpone or live without."
      },
      {
        "type": "p",
        "text": "Examples include:"
      },
      {
        "type": "list",
        "items": [
          "Buying a new pair of shoes when your current ones are still suitable.",
          "Ordering takeout when you already have food available.",
          "Upgrading your phone when your current one works well.",
          "Going on an outing that wasn't part of your spending plan.",
          "Purchasing something simply because it's trending."
        ]
      },
      {
        "type": "p",
        "text": "There's nothing wrong with spending money on things you enjoy. Your budget should leave room for fun when your finances allow it."
      },
      {
        "type": "strong",
        "text": "The goal isn't to eliminate your wants. It's to stop them from consistently taking money away from your needs."
      },
      {
        "type": "h",
        "text": "How Do You Tell the Difference?"
      },
      {
        "type": "p",
        "text": "Sometimes, the distinction isn't obvious."
      },
      {
        "type": "p",
        "text": "Before making a purchase, ask yourself these three questions:"
      },
      {
        "type": "h",
        "text": "1. Do I need this right now?"
      },
      {
        "type": "p",
        "text": "Consider whether the item is essential or whether you can comfortably wait before buying it."
      },
      {
        "type": "h",
        "text": "2. Have I covered my important expenses?"
      },
      {
        "type": "p",
        "text": "Check whether you have enough money for food, transportation, academic needs, and other upcoming commitments."
      },
      {
        "type": "h",
        "text": "3. What happens if I don't buy it today?"
      },
      {
        "type": "p",
        "text": "If postponing the purchase won't cause a serious problem, waiting might be the better option."
      },
      {
        "type": "p",
        "text": "These questions help you pause and think before spending impulsively."
      },
      {
        "type": "h",
        "text": "Let's Look at a Real-Life Example"
      },
      {
        "type": "p",
        "text": "Imagine you've received your ₦30,000 allowance for the month."
      },
      {
        "type": "p",
        "text": "After reviewing your expenses, you realise you need:"
      },
      {
        "type": "table",
        "rows": [
          [
            "Expense",
            "Amount"
          ],
          [
            "Food",
            "₦10,000"
          ],
          [
            "Transportation",
            "₦5,000"
          ],
          [
            "Data",
            "₦3,000"
          ],
          [
            "Academic materials",
            "₦4,000"
          ],
          [
            "Total essential expenses",
            "₦22,000"
          ]
        ]
      },
      {
        "type": "p",
        "text": "You have ₦8,000 remaining."
      },
      {
        "type": "p",
        "text": "Then you see a pair of shoes you like for ₦7,000."
      },
      {
        "type": "p",
        "text": "Should you buy them?"
      },
      {
        "type": "p",
        "text": "Not so fast."
      },
      {
        "type": "p",
        "text": "You still need to consider other upcoming expenses, unexpected costs, and any savings goals you've set."
      },
      {
        "type": "p",
        "text": "If buying the shoes would leave you unable to cover an important expense, postponing the purchase might be wiser."
      },
      {
        "type": "p",
        "text": "But if your essentials are covered and the purchase fits your budget, you can enjoy your money without feeling guilty."
      },
      {
        "type": "strong",
        "text": "A purchase isn't automatically a bad decision just because it's a want. What matters is whether you can comfortably afford it."
      },
      {
        "type": "h",
        "text": "Five Ways to Make Smarter Spending Decisions"
      },
      {
        "type": "h",
        "text": "1. Prioritise your essentials"
      },
      {
        "type": "p",
        "text": "When money comes in, identify the expenses you need to cover before allocating money to optional purchases."
      },
      {
        "type": "h",
        "text": "2. Give yourself a spending limit"
      },
      {
        "type": "p",
        "text": "Decide how much you can comfortably spend on entertainment, shopping, and other wants."
      },
      {
        "type": "h",
        "text": "3. Avoid pressure from friends"
      },
      {
        "type": "p",
        "text": "You don't have to spend money on every outing or trend to fit in. Your financial circumstances are your own."
      },
      {
        "type": "h",
        "text": "4. Wait before making non-essential purchases"
      },
      {
        "type": "p",
        "text": "If something catches your attention, give yourself time to think about whether you genuinely want or need it."
      },
      {
        "type": "h",
        "text": "5. Review your budget before spending"
      },
      {
        "type": "p",
        "text": "Your bank balance doesn't always show how much money you can safely spend. Some of that money may already be needed for upcoming expenses."
      },
      {
        "type": "h",
        "text": "Remember: Balance Is the Goal"
      },
      {
        "type": "p",
        "text": "Managing money doesn't mean saying no to every enjoyable experience."
      },
      {
        "type": "p",
        "text": "You can buy the shoes, go out with friends, order your favourite meal, and enjoy your student life."
      },
      {
        "type": "p",
        "text": "The important thing is to make those decisions with an understanding of what your money needs to cover."
      },
      {
        "type": "p",
        "text": "When you prioritise your needs and plan for your wants, you give yourself more freedom to enjoy your money without constantly worrying about what you'll run out of."
      },
      {
        "type": "h",
        "text": "The Takeaway"
      },
      {
        "type": "strong",
        "text": "Needs come first, but wants still have a place in your budget."
      },
      {
        "type": "p",
        "text": "Learning the difference helps you make intentional spending decisions, protect your essentials, and work towards your financial goals without feeling unnecessarily restricted."
      },
      {
        "type": "h",
        "text": "Ready to put this into practice?"
      },
      {
        "type": "p",
        "text": "Use Allawii's Budget Planner to organise your expenses, set spending limits, and see how much you can comfortably afford to spend."
      },
      {
        "type": "p",
        "text": "Spend with intention. Enjoy without regret."
      }
    ]
  },
  {
    "id": "3",
    "title": "Making Your Allowance Last: A Student's Guide to Managing Money",
    "description": "Make one allowance stretch across the whole month, not just two weeks.",
    "category": "budgeting",
    "duration": 5,
    "blocks": [
      {
        "type": "p",
        "text": "It's the beginning of the month. Your allowance has just arrived, and you feel like you finally have enough money to do everything you want."
      },
      {
        "type": "p",
        "text": "Fast-forward two weeks, and you're checking your balance, wondering where it all went."
      },
      {
        "type": "p",
        "text": "Sound familiar?"
      },
      {
        "type": "p",
        "text": "Making your allowance last isn't necessarily about receiving more money. Sometimes, it's about planning what you have so that it covers your needs until your next payment arrives."
      },
      {
        "type": "p",
        "text": "Here's how to get started."
      },
      {
        "type": "h",
        "text": "1. Know How Long Your Money Needs to Last"
      },
      {
        "type": "p",
        "text": "Before spending anything, identify when you'll receive your next allowance."
      },
      {
        "type": "p",
        "text": "Is it in one week, two weeks, or a month?"
      },
      {
        "type": "p",
        "text": "Knowing your spending period helps you make better decisions about how much you can afford to use now."
      },
      {
        "type": "p",
        "text": "For example, if you receive ₦40,000 to last four weeks, spending ₦15,000 in the first week could leave you struggling later."
      },
      {
        "type": "strong",
        "text": "The goal is to plan for the entire period, not just the first few days."
      },
      {
        "type": "h",
        "text": "2. Set Aside Money for Essentials"
      },
      {
        "type": "p",
        "text": "Some expenses are more important than others because you need to cover them regardless of what else happens."
      },
      {
        "type": "p",
        "text": "These might include:"
      },
      {
        "type": "list",
        "items": [
          "Food and groceries.",
          "Transportation to lectures.",
          "Data and airtime.",
          "Academic materials.",
          "Other essential personal expenses."
        ]
      },
      {
        "type": "p",
        "text": "Estimate how much you'll need for these expenses and account for them before deciding how much money is available for other things."
      },
      {
        "type": "p",
        "text": "This prevents you from accidentally spending money you'll need later."
      },
      {
        "type": "h",
        "text": "3. Divide Your Allowance Into Weeks"
      },
      {
        "type": "p",
        "text": "One way to manage your money is to divide it into weekly amounts."
      },
      {
        "type": "p",
        "text": "Suppose you receive ₦40,000 for four weeks."
      },
      {
        "type": "p",
        "text": "You might start by dividing it into ₦10,000 per week. However, this only works if your expenses are relatively even across the month."
      },
      {
        "type": "p",
        "text": "If you have larger expenses, such as academic materials or transportation costs, account for those first."
      },
      {
        "type": "p",
        "text": "For example:"
      },
      {
        "type": "table",
        "rows": [
          [
            "Allocation",
            "Amount"
          ],
          [
            "Food",
            "₦16,000"
          ],
          [
            "Transportation",
            "₦8,000"
          ],
          [
            "Data and airtime",
            "₦3,000"
          ],
          [
            "Academic expenses",
            "₦4,000"
          ],
          [
            "Personal spending",
            "₦3,000"
          ],
          [
            "Emergency buffer",
            "₦3,000"
          ],
          [
            "Savings",
            "₦3,000"
          ],
          [
            "Total",
            "₦40,000"
          ]
        ]
      },
      {
        "type": "p",
        "text": "This is an illustrative budget, not a recommended allocation for every student. Your own expenses and financial circumstances should determine how you divide your money."
      },
      {
        "type": "p",
        "text": "Once you've allocated money to your expenses, you'll have a clearer idea of how much is available for each week."
      },
      {
        "type": "h",
        "text": "4. Watch the Small Expenses"
      },
      {
        "type": "p",
        "text": "Sometimes, it's not one expensive purchase that drains your allowance. It's several small purchases that gradually add up."
      },
      {
        "type": "p",
        "text": "A snack here, an extra ride there, another data subscription, and an unplanned purchase can take up more of your money than you realise."
      },
      {
        "type": "p",
        "text": "Consider this example:"
      },
      {
        "type": "p",
        "text": "If you spend an extra ₦500 every day, that's ₦3,500 in a week."
      },
      {
        "type": "p",
        "text": "Over four weeks, that becomes ₦14,000."
      },
      {
        "type": "p",
        "text": "That doesn't mean every small purchase is unnecessary. It simply shows why understanding your spending habits matters."
      },
      {
        "type": "p",
        "text": "Try recording your expenses for a week. You may discover patterns you hadn't noticed before."
      },
      {
        "type": "h",
        "text": "5. Give Yourself Room to Enjoy Your Money"
      },
      {
        "type": "p",
        "text": "Managing your allowance doesn't mean you must stop having fun."
      },
      {
        "type": "p",
        "text": "It's okay to go out with friends, buy something you like, or enjoy a meal outside your usual routine."
      },
      {
        "type": "p",
        "text": "The important thing is to decide how much you can comfortably spend without affecting your essential expenses."
      },
      {
        "type": "p",
        "text": "When you include personal spending in your budget, you can enjoy those moments without constantly worrying about whether you've made a mistake."
      },
      {
        "type": "strong",
        "text": "A realistic budget is easier to maintain than one that leaves no room for enjoyment."
      },
      {
        "type": "h",
        "text": "6. Prepare for Unexpected Expenses"
      },
      {
        "type": "p",
        "text": "Not every expense arrives when you expect it."
      },
      {
        "type": "p",
        "text": "You might need extra money for transportation, an academic requirement, or an urgent personal need."
      },
      {
        "type": "p",
        "text": "If possible, keep a small amount aside for these situations."
      },
      {
        "type": "p",
        "text": "Even a modest buffer can give you more flexibility when something unexpected happens."
      },
      {
        "type": "p",
        "text": "If you need to use it, review your remaining budget and decide how to adjust your plans."
      },
      {
        "type": "p",
        "text": "Remember, the goal isn't to predict everything. It's to give yourself room to respond when plans change."
      },
      {
        "type": "h",
        "text": "7. Check Your Spending Before Your Money Runs Low"
      },
      {
        "type": "p",
        "text": "Don't wait until your balance is almost empty before reviewing your finances."
      },
      {
        "type": "p",
        "text": "Check your spending regularly and ask yourself:"
      },
      {
        "type": "list",
        "items": [
          "How much money do I have left?",
          "What expenses do I still need to cover?",
          "How many days are left until my next allowance?",
          "Am I spending faster than I planned?",
          "Do I need to adjust anything?"
        ]
      },
      {
        "type": "p",
        "text": "If you've spent more than expected, don't panic. Identify what changed and make a realistic plan for the remaining days."
      },
      {
        "type": "p",
        "text": "The earlier you notice a problem, the more options you may have to address it."
      },
      {
        "type": "h",
        "text": "8. Adjust Your Plan When Things Change"
      },
      {
        "type": "p",
        "text": "Sometimes, your original budget won't work as expected."
      },
      {
        "type": "p",
        "text": "Prices may increase, an unexpected expense may arise, or you may spend more in one category than you planned."
      },
      {
        "type": "p",
        "text": "Instead of abandoning your budget, review it."
      },
      {
        "type": "p",
        "text": "You might reduce optional spending, adjust a savings contribution, or redistribute money between categories where it's reasonable to do so."
      },
      {
        "type": "p",
        "text": "However, don't sacrifice essential needs just to preserve an unrealistic plan."
      },
      {
        "type": "p",
        "text": "Your budget should support your life, not make it harder."
      },
      {
        "type": "h",
        "text": "A Quick Challenge: Try the Seven-Day Check-In"
      },
      {
        "type": "p",
        "text": "For the next seven days, try these three things:"
      },
      {
        "type": "p",
        "text": "Day 1: Write down how much money you have available and the expenses you still need to cover."
      },
      {
        "type": "p",
        "text": "Days 2–6: Record your spending and check whether you're staying within your plan."
      },
      {
        "type": "p",
        "text": "Day 7: Review your transactions. Identify one thing that worked well and one thing you'd like to change next week."
      },
      {
        "type": "p",
        "text": "You don't have to get everything right. The purpose is to understand your habits and learn from them."
      },
      {
        "type": "h",
        "text": "The Takeaway"
      },
      {
        "type": "p",
        "text": "Making your allowance last starts with knowing what you have, planning for what you need, and paying attention to how you spend."
      },
      {
        "type": "p",
        "text": "You won't always follow your budget perfectly, and that's okay. What matters is recognising when something needs to change and making adjustments before the situation becomes more difficult."
      },
      {
        "type": "strong",
        "text": "You may not control when every expense arrives, but you can build a better plan for handling your money."
      },
      {
        "type": "h",
        "text": "Ready to take control of your allowance?"
      },
      {
        "type": "p",
        "text": "Use Allawii's Allowance Manager to enter your allowance amount, set your next payment date, plan your expenses, and see how your budget changes as you spend."
      },
      {
        "type": "p",
        "text": "Make your money last. Make your decisions count."
      }
    ]
  },
  {
    "id": "4",
    "title": "Saving on a Student Allowance: Small Steps, Real Progress",
    "description": "Build a saving habit that works even when your allowance is small.",
    "category": "saving",
    "duration": 5,
    "blocks": [
      {
        "type": "p",
        "text": "Let's be honest: saving money as a student isn't always easy."
      },
      {
        "type": "p",
        "text": "Between food, transportation, data, academic expenses, and trying to enjoy university life, it can feel like your allowance is already spoken for before you even receive it."
      },
      {
        "type": "p",
        "text": "You might wonder, How am I supposed to save when I barely have enough?"
      },
      {
        "type": "p",
        "text": "The good news is that saving doesn't have to start with a large amount. It starts with understanding your finances, setting realistic goals, and building a habit that works for your circumstances."
      },
      {
        "type": "p",
        "text": "Here's how to get started."
      },
      {
        "type": "h",
        "text": "1. Understand Why You Want to Save"
      },
      {
        "type": "p",
        "text": "Saving becomes easier to plan when you have a reason for doing it."
      },
      {
        "type": "p",
        "text": "Instead of simply telling yourself, \"I need to save money,\" identify what you're saving towards."
      },
      {
        "type": "p",
        "text": "Your goal could be:"
      },
      {
        "type": "list",
        "items": [
          "Buying a laptop or upgrading your current one.",
          "Paying for a course or professional certification.",
          "Building an emergency fund.",
          "Starting a small business.",
          "Paying for an upcoming academic expense.",
          "Buying something you've wanted for a while."
        ]
      },
      {
        "type": "p",
        "text": "Having a clear goal gives your savings a purpose and helps you decide how much you need."
      },
      {
        "type": "p",
        "text": "You don't have to know exactly how you'll achieve the goal immediately. Start by identifying what matters to you."
      },
      {
        "type": "h",
        "text": "2. Start With What You Can Afford"
      },
      {
        "type": "p",
        "text": "One common mistake is believing that saving only counts when you put aside a large amount."
      },
      {
        "type": "p",
        "text": "It doesn't."
      },
      {
        "type": "p",
        "text": "If your allowance is limited, starting small may be more realistic than setting an ambitious target you cannot maintain."
      },
      {
        "type": "p",
        "text": "For example, imagine you can comfortably save ₦500 each week."
      },
      {
        "type": "table",
        "rows": [
          [
            "Time",
            "Total Contributions"
          ],
          [
            "1 week",
            "₦500"
          ],
          [
            "4 weeks",
            "₦2,000"
          ],
          [
            "8 weeks",
            "₦4,000"
          ],
          [
            "12 weeks",
            "₦6,000"
          ]
        ]
      },
      {
        "type": "p",
        "text": "These figures assume you make every contribution and don't withdraw any money."
      },
      {
        "type": "p",
        "text": "₦500 might not seem like much, but the example shows how small contributions can accumulate over time."
      },
      {
        "type": "p",
        "text": "However, if your essential expenses already use up your entire allowance, don't force yourself to save money you need for food, transportation, or other necessities."
      },
      {
        "type": "strong",
        "text": "The right savings amount is one that fits your actual financial situation."
      },
      {
        "type": "h",
        "text": "3. Set a Realistic Savings Goal"
      },
      {
        "type": "p",
        "text": "Once you know what you're saving for, decide how much you'll need."
      },
      {
        "type": "p",
        "text": "Let's say you want to buy something that costs ₦12,000 and hope to reach your goal in three months."
      },
      {
        "type": "p",
        "text": "If you have 12 weeks, you would need to contribute an average of ₦1,000 each week to reach your target."
      },
      {
        "type": "p",
        "text": "Before committing, ask yourself whether that amount is realistic after accounting for your essential expenses."
      },
      {
        "type": "p",
        "text": "If it isn't, you have options:"
      },
      {
        "type": "list",
        "items": [
          "Extend your timeline.",
          "Reduce the target if you're able to choose a less expensive alternative.",
          "Contribute smaller amounts.",
          "Increase contributions during weeks when you have more money available."
        ]
      },
      {
        "type": "p",
        "text": "Your savings plan should work with your circumstances rather than create additional financial pressure."
      },
      {
        "type": "h",
        "text": "4. Save When You Receive Your Allowance"
      },
      {
        "type": "p",
        "text": "If your budget allows, consider setting aside your planned savings contribution when your allowance arrives."
      },
      {
        "type": "p",
        "text": "Why?"
      },
      {
        "type": "p",
        "text": "When you wait until the end of the month, you may find that other expenses have used up the money you intended to save."
      },
      {
        "type": "p",
        "text": "Setting aside your contribution early can help you stay consistent."
      },
      {
        "type": "p",
        "text": "However, this doesn't mean savings should automatically take priority over essential expenses. Make sure you have a realistic plan for the necessities your allowance needs to cover."
      },
      {
        "type": "p",
        "text": "If your financial situation changes, you can adjust your contribution."
      },
      {
        "type": "h",
        "text": "5. Make Saving Flexible"
      },
      {
        "type": "p",
        "text": "Some weeks, you'll have more expenses than others."
      },
      {
        "type": "p",
        "text": "You might need extra money for transportation, academic materials, or an unexpected personal expense."
      },
      {
        "type": "p",
        "text": "When that happens, your savings plan should be flexible enough to accommodate reality."
      },
      {
        "type": "p",
        "text": "You could:"
      },
      {
        "type": "list",
        "items": [
          "Reduce your contribution temporarily.",
          "Pause contributions when necessary.",
          "Resume saving when your finances allow.",
          "Extend your target date instead of putting pressure on yourself to catch up immediately."
        ]
      },
      {
        "type": "p",
        "text": "Missing a contribution doesn't mean you've failed."
      },
      {
        "type": "strong",
        "text": "A good savings habit should support your financial well-being, not compete with your basic needs."
      },
      {
        "type": "h",
        "text": "6. Separate Your Savings From Everyday Spending"
      },
      {
        "type": "p",
        "text": "When savings and everyday spending money are mixed together, it can become difficult to tell how much you've genuinely set aside."
      },
      {
        "type": "p",
        "text": "Consider keeping track of your savings separately, whether through a suitable savings account, a dedicated savings feature, or another secure method appropriate for your circumstances."
      },
      {
        "type": "p",
        "text": "Be sure to understand any fees, withdrawal restrictions, or other conditions before choosing a financial product."
      },
      {
        "type": "p",
        "text": "The goal is to make your progress visible and reduce the temptation to treat every available naira as money you can spend immediately."
      },
      {
        "type": "h",
        "text": "7. Celebrate Progress, Not Just the Final Goal"
      },
      {
        "type": "p",
        "text": "Suppose your goal is to save ₦20,000, and you've reached ₦5,000."
      },
      {
        "type": "p",
        "text": "You haven't reached the final target yet, but you've made progress."
      },
      {
        "type": "p",
        "text": "Recognising these milestones can help you stay motivated."
      },
      {
        "type": "p",
        "text": "You could celebrate reaching 25%, 50%, and 75% of your target. The celebration doesn't need to involve spending money; simply acknowledging your progress is enough."
      },
      {
        "type": "p",
        "text": "And remember, saving isn't always a straight line. If you need to use some money for a genuine emergency, you can rebuild your savings when you're able."
      },
      {
        "type": "p",
        "text": "Your financial progress shouldn't be measured by a perfect record."
      },
      {
        "type": "h",
        "text": "Common Savings Mistakes to Avoid"
      },
      {
        "type": "p",
        "text": "Saving an unrealistic amount: Choose a contribution you can reasonably afford."
      },
      {
        "type": "p",
        "text": "Ignoring essential expenses: Don't sacrifice necessary food, transport, healthcare, or academic needs to meet a savings target."
      },
      {
        "type": "p",
        "text": "Comparing yourself with others: Another student's allowance and responsibilities may be completely different from yours."
      },
      {
        "type": "p",
        "text": "Giving up after missing a contribution: Adjust your plan and continue when you're ready."
      },
      {
        "type": "p",
        "text": "Setting a goal without a timeline: A realistic target and timeframe can make your progress easier to track."
      },
      {
        "type": "p",
        "text": "Treating every withdrawal as failure: Sometimes, using savings for an unexpected need is exactly why you saved in the first place."
      },
      {
        "type": "h",
        "text": "Your Small-Step Savings Challenge"
      },
      {
        "type": "p",
        "text": "Here's something you can try this week:"
      },
      {
        "type": "p",
        "text": "Step 1: Choose one thing you'd like to save for."
      },
      {
        "type": "p",
        "text": "Step 2: Estimate how much it will cost."
      },
      {
        "type": "p",
        "text": "Step 3: Decide how much you can comfortably contribute without neglecting essential expenses."
      },
      {
        "type": "p",
        "text": "Step 4: Choose a realistic target date."
      },
      {
        "type": "p",
        "text": "Step 5: Track your progress and adjust your plan when necessary."
      },
      {
        "type": "p",
        "text": "You don't need to start with a large amount. You just need a plan that makes sense for you."
      },
      {
        "type": "h",
        "text": "The Takeaway"
      },
      {
        "type": "p",
        "text": "Saving on a student allowance isn't about putting away the most money or competing with people who have more financial resources."
      },
      {
        "type": "p",
        "text": "It's about understanding your priorities, making realistic decisions, and preparing for future needs when your circumstances allow."
      },
      {
        "type": "p",
        "text": "Some weeks, you may save more. Other weeks, you may need to save less or pause entirely. Both can be part of a sustainable financial plan."
      },
      {
        "type": "strong",
        "text": "Start small. Stay flexible. Build towards what matters to you."
      },
      {
        "type": "h",
        "text": "Ready to start saving with Allawii?"
      },
      {
        "type": "p",
        "text": "Head to Allawii's Savings Goals to create a goal, set your target amount, choose a contribution plan, and track your progress over time."
      },
      {
        "type": "p",
        "text": "Small steps today. More possibilities tomorrow."
      }
    ]
  },
  {
    "id": "5",
    "title": "Controlling Impulse Spending",
    "description": "Understand the triggers behind unplanned spending and slow the decision down.",
    "category": "spending",
    "duration": 5,
    "blocks": [
      {
        "type": "p",
        "text": "Have you ever bought something you didn't plan for, only to wonder later why you spent the money?"
      },
      {
        "type": "p",
        "text": "Maybe it was a snack you didn't need, a cute outfit you saw online, a flash sale that felt too good to miss, or an unplanned outing with friends."
      },
      {
        "type": "p",
        "text": "It happens. And it doesn't mean you're bad with money."
      },
      {
        "type": "p",
        "text": "Impulse spending is when you buy something spontaneously, without properly considering whether you need it, can afford it, or should prioritise something else."
      },
      {
        "type": "p",
        "text": "The goal isn't to stop enjoying your money. It's to make sure your spending reflects what matters to you."
      },
      {
        "type": "p",
        "text": "Here's how to get started."
      },
      {
        "type": "h",
        "text": "1. Understand What Triggers Your Spending"
      },
      {
        "type": "p",
        "text": "Before you can manage impulse spending, you need to understand what causes it."
      },
      {
        "type": "p",
        "text": "Ask yourself:"
      },
      {
        "type": "list",
        "items": [
          "Do I shop when I'm bored or stressed?",
          "Do I buy things because my friends have them?",
          "Do discounts make me feel like I'm missing out?",
          "Do I spend more when I receive my allowance?",
          "Do I make purchases because they're convenient, even when cheaper options exist?"
        ]
      },
      {
        "type": "p",
        "text": "For example, you might receive your monthly allowance and immediately start ordering food, buying clothes, or making plans with friends."
      },
      {
        "type": "p",
        "text": "Recognising this pattern helps you prepare for it instead of repeatedly wondering where your money went."
      },
      {
        "type": "p",
        "text": "Try this: The next time you make an unplanned purchase, note what you were feeling and what influenced your decision."
      },
      {
        "type": "h",
        "text": "2. Give Yourself a Pause Before Buying"
      },
      {
        "type": "p",
        "text": "Not every purchase needs an immediate decision."
      },
      {
        "type": "p",
        "text": "When you see something you want, pause before paying. Give yourself time to decide whether you genuinely want it or are simply caught up in the moment."
      },
      {
        "type": "p",
        "text": "Try these questions:"
      },
      {
        "type": "list",
        "items": [
          "Do I actually need this right now?",
          "Did I plan to buy it before I saw it?",
          "Will buying it affect money I've set aside for essentials?",
          "Would I still want it tomorrow?"
        ]
      },
      {
        "type": "p",
        "text": "For non-essential purchases, try the 24-hour rule: wait a day before buying."
      },
      {
        "type": "p",
        "text": "For more expensive items, consider waiting several days or even a week."
      },
      {
        "type": "p",
        "text": "You might discover that the excitement fades and you'd rather keep the money for something else."
      },
      {
        "type": "h",
        "text": "3. Set Aside Money for Fun"
      },
      {
        "type": "p",
        "text": "A budget shouldn't make you feel like you can never enjoy yourself."
      },
      {
        "type": "p",
        "text": "If your entire allowance goes towards essentials and savings, you might feel restricted and eventually spend impulsively out of frustration."
      },
      {
        "type": "p",
        "text": "Instead, if your finances allow it, create a small amount for enjoyment."
      },
      {
        "type": "p",
        "text": "This could cover:"
      },
      {
        "type": "list",
        "items": [
          "Snacks and drinks.",
          "Outings with friends.",
          "Clothes and accessories.",
          "Entertainment or subscriptions."
        ]
      },
      {
        "type": "p",
        "text": "For example, if you receive ₦30,000 monthly, you might decide to reserve ₦3,000 for non-essential purchases after considering your essential expenses and other priorities."
      },
      {
        "type": "p",
        "text": "The amount will depend on your circumstances. If your allowance barely covers your needs, it's okay if there's little or nothing left for extras."
      },
      {
        "type": "strong",
        "text": "The point is to enjoy your money without accidentally spending what you need elsewhere."
      },
      {
        "type": "h",
        "text": "4. Make Impulse Buying Less Convenient"
      },
      {
        "type": "p",
        "text": "Sometimes, the easiest way to spend less is to make unnecessary spending harder."
      },
      {
        "type": "p",
        "text": "Try these simple changes:"
      },
      {
        "type": "list",
        "items": [
          "Remove saved card details: An extra step before checkout gives you time to reconsider.",
          "Unfollow tempting shopping pages: Reduce exposure to products you weren't planning to buy.",
          "Turn off promotional notifications: Flash sales and limited-time offers can encourage rushed decisions.",
          "Avoid browsing shopping apps out of boredom: Browse with a purpose rather than looking for something to buy.",
          "Carry only what you need: When appropriate, take a planned amount for an outing instead of spending without a limit."
        ]
      },
      {
        "type": "p",
        "text": "You don't need to rely on willpower alone. Changing your environment can help you make better decisions."
      },
      {
        "type": "h",
        "text": "5. Remember What You're Saving For"
      },
      {
        "type": "p",
        "text": "It's easier to turn down an unnecessary purchase when you have something meaningful you're working towards."
      },
      {
        "type": "p",
        "text": "Perhaps you want to buy a new laptop, pay for a course, build an emergency fund, or save towards something you've wanted for months."
      },
      {
        "type": "p",
        "text": "Give that goal a name and remind yourself of it before making unplanned purchases."
      },
      {
        "type": "p",
        "text": "Imagine you see a pair of shoes for ₦8,000, but you're also saving towards a course that costs ₦20,000."
      },
      {
        "type": "p",
        "text": "Ask yourself whether buying the shoes is worth delaying your course goal."
      },
      {
        "type": "p",
        "text": "There isn't always a right or wrong answer. What matters is making the decision consciously rather than spending automatically."
      },
      {
        "type": "strong",
        "text": "Every naira you keep can bring you closer to something you genuinely value."
      },
      {
        "type": "h",
        "text": "6. Track Your Unplanned Purchases"
      },
      {
        "type": "p",
        "text": "Small purchases can seem insignificant individually but become substantial when they happen repeatedly."
      },
      {
        "type": "p",
        "text": "Imagine spending:"
      },
      {
        "type": "list",
        "items": [
          "₦500 on an unplanned snack each day.",
          "₦1,000 on an extra purchase twice a week.",
          "₦2,000 on an unplanned outing every weekend."
        ]
      },
      {
        "type": "p",
        "text": "Over time, these expenses can add up."
      },
      {
        "type": "p",
        "text": "Tracking your spending helps you see where your money is going without relying on memory."
      },
      {
        "type": "p",
        "text": "At the end of each week, review your transactions and ask:"
      },
      {
        "type": "list",
        "items": [
          "Which purchases were planned?",
          "Which ones were impulsive?",
          "Were any of them worth the money?",
          "What could I do differently next week?"
        ]
      },
      {
        "type": "p",
        "text": "Don't use this exercise to criticise yourself. Use it to understand your habits and make adjustments."
      },
      {
        "type": "p",
        "text": "With Allawii, you can use your expense tracking and spending insights to identify patterns and understand how unplanned purchases affect your budget."
      },
      {
        "type": "h",
        "text": "7. Don't Let One Mistake Ruin Your Progress"
      },
      {
        "type": "p",
        "text": "You planned to avoid unnecessary spending this week, but you bought something impulsively."
      },
      {
        "type": "p",
        "text": "Now what?"
      },
      {
        "type": "p",
        "text": "Don't give up on your budget because of one purchase."
      },
      {
        "type": "p",
        "text": "Instead:"
      },
      {
        "type": "list",
        "items": [
          "Record the expense honestly.",
          "Check how it affects your remaining allowance.",
          "Adjust your spending if necessary.",
          "Identify what triggered the purchase.",
          "Decide what you'll try differently next time."
        ]
      },
      {
        "type": "p",
        "text": "If an unexpected expense leaves you short of money for essentials, prioritise your immediate needs and adjust your plan realistically."
      },
      {
        "type": "p",
        "text": "The goal isn't perfect spending. It's developing habits that help you manage your money more intentionally over time."
      },
      {
        "type": "h",
        "text": "Your 7-Day Challenge: Pause Before You Pay"
      },
      {
        "type": "p",
        "text": "For the next seven days, try this:"
      },
      {
        "type": "p",
        "text": "Day 1: Identify one thing that usually triggers your impulse spending."
      },
      {
        "type": "p",
        "text": "Day 2: Before making an unplanned purchase, pause and ask whether you need it."
      },
      {
        "type": "p",
        "text": "Day 3: Wait 24 hours before buying a non-essential item."
      },
      {
        "type": "p",
        "text": "Day 4: Review your recent expenses and identify one spending pattern."
      },
      {
        "type": "p",
        "text": "Day 5: Remove one shopping notification or other temptation."
      },
      {
        "type": "p",
        "text": "Day 6: Think about a financial goal that matters to you before spending on an extra."
      },
      {
        "type": "p",
        "text": "Day 7: Review what you learned. Did pausing help you make different decisions?"
      },
      {
        "type": "p",
        "text": "You don't have to get everything right. Even one more thoughtful decision is progress."
      },
      {
        "type": "h",
        "text": "Final Takeaway"
      },
      {
        "type": "p",
        "text": "Controlling impulse spending doesn't mean saying no to everything you enjoy. It means learning to distinguish between what you want in the moment and what matters to you in the long run."
      },
      {
        "type": "p",
        "text": "You can enjoy your allowance, treat yourself, and spend time with friends while still working towards your financial goals."
      },
      {
        "type": "h",
        "text": "The next time you want to buy something, pause and ask yourself: \"Is this what I really want my money to do for me?\""
      },
      {
        "type": "p",
        "text": "That small question can make a meaningful difference."
      },
      {
        "type": "h",
        "text": "Put It Into Practice with Allawii"
      },
      {
        "type": "p",
        "text": "Use Allawii's expense tracker to record your purchases, explore your spending insights to spot patterns, and check your budget before making your next purchase."
      },
      {
        "type": "strong",
        "text": "Spend with intention. Keep your goals in sight."
      }
    ]
  },
  {
    "id": "6",
    "title": "Avoiding Financial Scams",
    "description": "Spot the scams that target students and protect your money and details.",
    "category": "safety",
    "duration": 5,
    "blocks": [
      {
        "type": "p",
        "text": "Imagine receiving a message saying you've won ₦50,000 in a giveaway. All you need to do is pay a ₦2,000 processing fee to claim your prize."
      },
      {
        "type": "p",
        "text": "Or perhaps someone sends you a scholarship link promising to secure your admission and funding if you pay a small registration fee."
      },
      {
        "type": "p",
        "text": "The offer sounds exciting. The opportunity seems real. And because you don't want to miss out, you consider paying."
      },
      {
        "type": "p",
        "text": "But there's a problem: the offer might be a scam designed to take your money or personal information."
      },
      {
        "type": "p",
        "text": "Financial scams can target anyone, including university students looking for scholarships, internships, jobs, affordable loans, or ways to earn extra income."
      },
      {
        "type": "p",
        "text": "Learning to recognise the warning signs can help you protect your money and make safer financial decisions."
      },
      {
        "type": "h",
        "text": "1. Know the Common Types of Financial Scams"
      },
      {
        "type": "p",
        "text": "Scams come in different forms. Here are some you may encounter as a student."
      },
      {
        "type": "h",
        "text": "Fake scholarships and grants"
      },
      {
        "type": "p",
        "text": "You receive a message promising a scholarship or student grant, but you're asked to pay an application, verification, or processing fee to secure it."
      },
      {
        "type": "p",
        "text": "Some legitimate programmes have application requirements, but a demand for payment to guarantee a scholarship is a serious warning sign. Verify the opportunity through the organisation's official channels before proceeding."
      },
      {
        "type": "h",
        "text": "Fake job and internship offers"
      },
      {
        "type": "p",
        "text": "Someone offers you a remote job with an unusually high salary for very little work. Before you can start, they ask you to pay for training, registration, equipment, or onboarding."
      },
      {
        "type": "p",
        "text": "Be cautious, especially when the recruiter cannot be independently verified or pressures you to pay immediately."
      },
      {
        "type": "h",
        "text": "Investment scams"
      },
      {
        "type": "p",
        "text": "You see someone promising to double your money within days or guaranteeing unusually high returns with little or no risk."
      },
      {
        "type": "p",
        "text": "They might describe the opportunity as cryptocurrency trading, forex, an investment platform, or a private business scheme."
      },
      {
        "type": "p",
        "text": "Remember: legitimate investments carry risk, and guaranteed extraordinary returns are a major red flag."
      },
      {
        "type": "h",
        "text": "Fake giveaways and prize messages"
      },
      {
        "type": "p",
        "text": "A message claims you've won a phone, cash prize, or shopping voucher, even though you never entered a competition."
      },
      {
        "type": "p",
        "text": "You are then asked to pay a fee or provide sensitive information to claim the prize."
      },
      {
        "type": "h",
        "text": "Impersonation scams"
      },
      {
        "type": "p",
        "text": "Someone pretends to be a bank representative, a school official, a relative, or someone you trust."
      },
      {
        "type": "p",
        "text": "They may claim there's an urgent problem with your account or ask you to transfer money to help resolve an emergency."
      },
      {
        "type": "p",
        "text": "Always verify their identity independently before taking action."
      },
      {
        "type": "h",
        "text": "2. Recognise the Warning Signs"
      },
      {
        "type": "p",
        "text": "Scammers often use urgency, excitement, fear, or financial pressure to make you act before thinking."
      },
      {
        "type": "p",
        "text": "Watch out for these red flags:"
      },
      {
        "type": "list",
        "items": [
          "Guaranteed profits: Someone promises unusually high returns without risk.",
          "Urgent payment demands: You're told to pay immediately or lose the opportunity.",
          "Upfront fees: You must send money before receiving a promised job, prize, loan, or benefit.",
          "Requests for confidential information: Someone asks for your PIN, password, one-time password (OTP), or banking details.",
          "Unverified links: A message directs you to a website you cannot independently confirm is legitimate.",
          "Unusual payment methods: You're asked to send money to an unfamiliar personal account or wallet without a clear, verifiable reason.",
          "Pressure to recruit others: You're encouraged to bring in friends to earn money, especially when the scheme's main source of income appears to be recruitment."
        ]
      },
      {
        "type": "p",
        "text": "One warning sign doesn't automatically prove that something is fraudulent. However, several warning signs together should make you stop and investigate."
      },
      {
        "type": "h",
        "text": "3. Verify Before You Pay"
      },
      {
        "type": "p",
        "text": "When an opportunity looks attractive, take a moment to check whether it's genuine."
      },
      {
        "type": "strong",
        "text": "Step 1: Find the official source."
      },
      {
        "type": "p",
        "text": "Look for the organisation's official website and verified communication channels. Don't rely solely on a link or phone number provided in the message you received."
      },
      {
        "type": "strong",
        "text": "Step 2: Check the details."
      },
      {
        "type": "p",
        "text": "Look for the organisation's name, contact information, eligibility requirements, application process, and terms."
      },
      {
        "type": "p",
        "text": "Be cautious if the information is inconsistent or difficult to verify."
      },
      {
        "type": "strong",
        "text": "Step 3: Contact the organisation independently."
      },
      {
        "type": "p",
        "text": "If you're unsure about a scholarship, job, grant, or financial service, contact the organisation through contact details obtained independently from its official channels."
      },
      {
        "type": "strong",
        "text": "Step 4: Don't let a deadline rush you."
      },
      {
        "type": "p",
        "text": "A genuine opportunity should withstand reasonable verification. Missing an unverified opportunity is better than losing money to a scam."
      },
      {
        "type": "strong",
        "text": "Step 5: Ask someone you trust."
      },
      {
        "type": "p",
        "text": "If you're uncertain, discuss the offer with someone who can help you assess it objectively before making a payment."
      },
      {
        "type": "h",
        "text": "4. Protect Your Banking Information"
      },
      {
        "type": "p",
        "text": "Your financial information can be just as valuable to a scammer as your money."
      },
      {
        "type": "p",
        "text": "Follow these safety practices:"
      },
      {
        "type": "list",
        "items": [
          "Never share your banking PIN, password, or OTP with another person.",
          "Never approve a transaction you did not initiate or do not understand.",
          "Avoid entering banking details on unfamiliar websites.",
          "Use strong, unique passwords for your financial accounts.",
          "Enable transaction notifications where available.",
          "Keep your banking applications and phone software updated.",
          "Avoid conducting sensitive financial transactions on devices you do not trust.",
          "Check payment recipient details carefully before confirming a transfer."
        ]
      },
      {
        "type": "p",
        "text": "Important: A person claiming to be from your bank does not need you to disclose your PIN or OTP to prove your identity."
      },
      {
        "type": "p",
        "text": "If you receive a suspicious call or message, end the interaction and contact your bank through its official channels."
      },
      {
        "type": "h",
        "text": "5. Be Careful With Online Money-Making Opportunities"
      },
      {
        "type": "p",
        "text": "As a student, you may be searching for ways to earn money alongside your studies."
      },
      {
        "type": "p",
        "text": "Unfortunately, scammers know this and often advertise opportunities that sound perfect for people who need extra income."
      },
      {
        "type": "p",
        "text": "Be especially cautious of offers that promise:"
      },
      {
        "type": "list",
        "items": [
          "Large payments for simple online tasks but require an initial deposit.",
          "Guaranteed profits from trading or investment platforms.",
          "Easy money for recruiting friends or classmates.",
          "Remote jobs that require payment before employment begins.",
          "Loans with unclear fees, terms, or repayment conditions."
        ]
      },
      {
        "type": "p",
        "text": "Before committing money, research the organisation, understand the terms, and consider whether the business model makes sense."
      },
      {
        "type": "p",
        "text": "Don't borrow money to invest in an opportunity you haven't properly verified."
      },
      {
        "type": "p",
        "text": "And remember: you don't have to take every opportunity offered to you. Protecting your money is also progress."
      },
      {
        "type": "h",
        "text": "6. What Should You Do If You've Been Scammed?"
      },
      {
        "type": "p",
        "text": "If you suspect you've been scammed, don't panic or waste time blaming yourself. Taking action quickly may help limit further losses."
      },
      {
        "type": "h",
        "text": "If you've transferred money:"
      },
      {
        "type": "list",
        "items": [
          "Contact your bank or payment provider immediately through official channels.",
          "Report the transaction and ask whether it can be stopped, recalled, or traced.",
          "Preserve transaction receipts, account details, messages, phone numbers, and other evidence.",
          "Report the incident to the appropriate authorities.",
          "Do not send additional money to anyone promising to recover your funds for an upfront fee."
        ]
      },
      {
        "type": "h",
        "text": "If you've shared sensitive information:"
      },
      {
        "type": "list",
        "items": [
          "Contact your bank immediately if your banking details or account credentials may be compromised.",
          "Change affected passwords using a trusted device.",
          "Secure your email and other accounts linked to your finances.",
          "Block or report suspicious contacts where appropriate.",
          "Monitor your accounts for unfamiliar transactions."
        ]
      },
      {
        "type": "h",
        "text": "Where can you report a suspected scam in Nigeria?"
      },
      {
        "type": "p",
        "text": "You can begin with these official channels:"
      },
      {
        "type": "list",
        "items": [
          "Central Bank of Nigeria — For information about regulated financial institutions and consumer complaints.",
          "Economic and Financial Crimes Commission (EFCC) — For reporting suspected financial crimes.",
          "Nigeria Police Force — For reporting suspected criminal activity."
        ]
      },
      {
        "type": "p",
        "text": "For a suspected banking fraud, contact your bank immediately rather than waiting for a formal complaint process to begin."
      },
      {
        "type": "h",
        "text": "7. Make Verification a Habit"
      },
      {
        "type": "p",
        "text": "You don't need to become a cybersecurity expert to make safer financial decisions."
      },
      {
        "type": "p",
        "text": "Start with three simple habits:"
      },
      {
        "type": "p",
        "text": "Pause: Don't pay or share information just because a message sounds urgent."
      },
      {
        "type": "p",
        "text": "Verify: Check the opportunity using independent, official sources."
      },
      {
        "type": "p",
        "text": "Protect: Keep your financial information private and report suspicious activity quickly."
      },
      {
        "type": "p",
        "text": "These habits are especially useful when you're searching for scholarships, internships, grants, side hustles, or investment opportunities."
      },
      {
        "type": "h",
        "text": "Your 7-Day Challenge: Become Scam-Aware"
      },
      {
        "type": "p",
        "text": "Put these habits into practice over the next week."
      },
      {
        "type": "p",
        "text": "Day 1: Learn to recognise three common scam warning signs."
      },
      {
        "type": "p",
        "text": "Day 2: Review your privacy settings and security measures on your financial accounts."
      },
      {
        "type": "p",
        "text": "Day 3: Examine a scholarship or job offer carefully and identify how you would verify it."
      },
      {
        "type": "p",
        "text": "Day 4: Check whether your banking transaction notifications are enabled."
      },
      {
        "type": "p",
        "text": "Day 5: Learn how to contact your bank through its official channels."
      },
      {
        "type": "p",
        "text": "Day 6: Discuss a common scam tactic with a friend or family member."
      },
      {
        "type": "p",
        "text": "Day 7: Create your personal rule: never pay, click, or share sensitive information under pressure."
      },
      {
        "type": "p",
        "text": "You don't need to wait until something goes wrong to start protecting yourself."
      },
      {
        "type": "h",
        "text": "Final Takeaway"
      },
      {
        "type": "p",
        "text": "A financial opportunity can look convincing and still be fraudulent. Scammers may use professional-looking websites, convincing messages, familiar names, and promises that appeal to your financial goals."
      },
      {
        "type": "p",
        "text": "You don't have to be suspicious of everything. You simply need to be willing to verify before you trust."
      },
      {
        "type": "strong",
        "text": "When money is involved, pause before you pay. Verify before you trust. Protect what you've worked for."
      },
      {
        "type": "h",
        "text": "Stay Financially Aware with Allawii"
      },
      {
        "type": "p",
        "text": "Use Allawii to build better money habits, track your finances, and stay intentional about your financial decisions."
      },
      {
        "type": "p",
        "text": "And remember: financial literacy isn't just about knowing how to make and save money. It's also about knowing how to protect it."
      }
    ]
  }
];
