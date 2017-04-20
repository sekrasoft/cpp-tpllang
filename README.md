# Функциональный язык, транслирующийся в шаблоны C++
## Введение. Шаблоны C++ как функциональный метаязык
Шаблоны в C++ - интересный функциональный язык для вычислений на этапе компиляции.
Всё в нём хорошо, только синтаксис сложноват.

Тут вполне можно определить метафункцию "конструктор списка":

    template <typename h, typename t>
    struct cons {
      typename h head;
      typename t tail;
    };

И некоторое метазначение "конец списка":
    
    struct nil;

Обычный тип здесь стал метазначением, а шаблонный тип - метафункцией.

Можно легко реализовать метафункцию, которая будет осуществлять конкатенацию списков.
Причём здесь работает паттерн матчинг!
Для возврата значения договоримся устанавливать вложенный тип `value` в нужное значение.

    template <typename list1, typename list2>
    struct concat {
      typedef cons<typename list1::head,
        typename concat<typename list1::tail, list2>::value> value;
    };
    
    template <typename list2>
    struct concat<nil, list2> {
      typedef list2 value;
    };

Всё вышеперечисленное вполне бы могло быть написано на Haskell:

    data List head tail = Cons head tail | Nil
    concat (Cons h t) list = Cons h (concat t list)
    concat Nil list = list

А ещё в метаязыке шаблонов C++ есть замыкания:

    template <typename list1>
    struct curried_concat {
      template <typename list2>
      struct with {
        typedef typename concat<list1, list2>::value value;
      };
    };

И ФВП, куда же без них:

    template <template <typename> class f, typename x>
    struct apply {
      typedef typename f<x>::value value;
    };

Применим частично применённый concat к списку:
    
    struct one;
    typedef cons<one, cons<one, cons<one, nil> > > my_list;
    typedef cons<one, cons<one, nil> > your_list;
    typedef apply<curried_concat<my_list>::with, your_list> our_lists;

typedef эквивалентен определению значения, которое зависит от других значений.

Для понятности - то же самое на Haskell:

    curried_concat = \list1 -> \list2 -> concat list1 list2
    apply f x = f x
    data One = One
    my_list = Cons One $ Cons One $ Cons One Nil
    your_list = Cons One $ Cons One Nil
    our_lists = apply (curried_concat my_list) your_list

## Синтаксический сахар
Tpllang (рабочее назчание) - язык, который компилируется в шаблоны C++.
Здесь есть C-подобный синтаксис, который по максимуму упрощён, но повторяет возможности шаблонов C++.
Вот, наш пример со списком, рассмотренный выше:

    cons (val h, val t) {
      head = h;
      tail = t;
    }
    
    nil;

    concat(val list1, val list2) = cons(list1.head, concat(list1.tail, list2))';
    concat(nil, val list2) = list2;

    curried_concat(val list1) {
      with(val list2) = concat(list1, list2);
    }
    
    apply(val -> val f, val x) = f(x);
    
    one;
    my_list = cons(one, cons(one, cons(one, nil)')')';
    your_list = cons(one, cons(one, nil)')';
    our_lists = apply(curried_concat(my_list).with, your_list);

Определения вида `f(x) = expr` компилируются в шаблонный класс, `x = expr` - в typedef и т.д.
Выражения вида `f(x)` компилируются в `typename f<x>::_value`.
Для случая, когда `_value` брать не нужно, используется апостроф: `f(x)'`.
Обратный оператор к апострофу - восклицательный знак: `f(x)` эквивалентно `f(x)'!`.
Подробнее - в примерах из папки examples.

На данном этапе ещё не всё реализовано как планировалось, поэтому выражение

    our_lists = apply(curried_concat(my_list).with, your_list);

вероятно, не будет корректно скомпилировано.

## Запуск
Чтобы работал парсер (мне пока лень генерировать парсер, поэтому использую вариант на лету):

    npm install pegjs

Дальше можно компилировать свои файлы:

    node src/compile <исходник>

## Примеры

    // tpllang                --------->     C++


    // Вставка кода на C++
    impure {
      #include <iostream>                    #include <iostream>
    }

    namespace binary {                       namespace binary {

      one; // просто значение                  struct one;
      zero;                                    struct zero;

      // Определение функции                   template <typename x, typename y>
      And(val x, val y);                       struct And;
      // Частные случаи                        template <typename x>
      And(val x, one) = x;                     struct And<x, one> {
                                                 typedef x _value;
                                               };
      And(val x, zero) = zero;                 template <typename x>
                                               struct And<x, zero> {
                                                 typedef zero _value;
                                               };
      // Просто как выражение
      Xor(val x, val y) =                      template <typename x, typename y>
        Or(And(x, Not(y)), And(Not(x), y));    struct Xor {
                                                 typedef typename Or <typename And <x,
                                                 typename Not <y> ::_value> ::_value,
                                                 typename And <typename Not <x> ::_value,
                                                 y> ::_value> :: _value;
                                               };
    } // ns binary                           } // end of namespace binary

    namespace list {                         namespace list {

      nil;                                     struct nil;
      // Функция "с полями"
      // множественный возврат в некотором смысле
      cons(val x, val y) {                     template <typename x, typename y>
        head = x;                              struct cons {
        tail = y;                                typedef x head;
      }                                          typedef y tail;
                                               };

      // Препроцессор позволяет задавать синонимы типам
      // Это единственное, что не транслируется в C++ напрямую
      // всё, кроме #type - возможности C++ с другим синтаксисом
      #type T = val;
      #type unary = T -> T;

      // ФВП map
      map(unary f, T list) =                   template <template <typename> class f, typename list>
        cons(f(list.head),                     struct map {
          map(f, list.tail))';                   typedef cons <typename f <typename list::head>
                                                 ::_value, typename map <f,
                                                 typename list::tail> ::_value>  _value;
                                               };
      map(unary f, nil) = nil;                 template <template <typename> class f>
                                               struct map<f, nil> {
                                                 typedef nil _value;
                                               };

    }                                        } // end of namespace list
