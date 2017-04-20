# �������������� ����, ��������������� � ������� C++
## ��������. ������� C++ ��� �������������� ��������
������� � C++ - ���������� �������������� ���� ��� ���������� �� ����� ����������.
�� � �� ������, ������ ��������� ���������.

��� ������ ����� ���������� ����������� "����������� ������":

    template <typename h, typename t>
    struct cons {
      typename h head;
      typename t tail;
    };

� ��������� ������������ "����� ������":
    
    struct nil;

������� ��� ����� ���� �������������, � ��������� ��� - ������������.

����� ����� ����������� �����������, ������� ����� ������������ ������������ �������.
������ ����� �������� ������� �������!
��� �������� �������� ����������� ������������� ��������� ��� `value` � ������ ��������.

    template <typename list1, typename list2>
    struct concat {
      typedef cons<typename list1::head,
        typename concat<typename list1::tail, list2>::value> value;
    };
    
    template <typename list2>
    struct concat<nil, list2> {
      typedef list2 value;
    };

�� ����������������� ������ �� ����� ���� �������� �� Haskell:

    data List head tail = Cons head tail | Nil
    concat (Cons h t) list = Cons h (concat t list)
    concat Nil list = list

� ��� � ��������� �������� C++ ���� ���������:

    template <typename list1>
    struct curried_concat {
      template <typename list2>
      struct with {
        typedef typename concat<list1, list2>::value value;
      };
    };

� ���, ���� �� ��� ���:

    template <template <typename> class f, typename x>
    struct apply {
      typedef typename f<x>::value value;
    };

�������� �������� ���������� concat � ������:
    
    struct one;
    typedef cons<one, cons<one, cons<one, nil> > > my_list;
    typedef cons<one, cons<one, nil> > your_list;
    typedef apply<curried_concat<my_list>::with, your_list> our_lists;

typedef ������������ ����������� ��������, ������� ������� �� ������ ��������.

��� ���������� - �� �� ����� �� Haskell:

    curried_concat = \list1 -> \list2 -> concat list1 list2
    apply f x = f x
    data One = One
    my_list = Cons One $ Cons One $ Cons One Nil
    your_list = Cons One $ Cons One Nil
    our_lists = apply (curried_concat my_list) your_list

## �������������� �����
Tpllang (������� ��������) - ����, ������� ������������� � ������� C++.
����� ���� C-�������� ���������, ������� �� ��������� �������, �� ��������� ����������� �������� C++.
���, ��� ������ �� �������, ������������� ����:

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

����������� ���� `f(x) = expr` ������������� � ��������� �����, `x = expr` - � typedef � �.�.
��������� ���� `f(x)` ������������� � `typename f<x>::_value`.
��� ������, ����� `_value` ����� �� �����, ������������ ��������: `f(x)'`.
�������� �������� � ��������� - ��������������� ����: `f(x)` ������������ `f(x)'!`.
��������� - � �������� �� ����� examples.

�� ������ ����� ��� �� �� ����������� ��� �������������, ������� ���������

    our_lists = apply(curried_concat(my_list).with, your_list);

��������, �� ����� ��������� ��������������.

## ������
����� ������� ������ (��� ���� ���� ������������ ������, ������� ��������� ������� �� ����):

    npm install pegjs

������ ����� ������������� ���� �����:

    node src/compile <��������>

## �������

    // tpllang                --------->     C++


    // ������� ���� �� C++
    impure {
      #include <iostream>                    #include <iostream>
    }

    namespace binary {                       namespace binary {

      one; // ������ ��������                  struct one;
      zero;                                    struct zero;

      // ����������� �������                   template <typename x, typename y>
      And(val x, val y);                       struct And;
      // ������� ������                        template <typename x>
      And(val x, one) = x;                     struct And<x, one> {
                                                 typedef x _value;
                                               };
      And(val x, zero) = zero;                 template <typename x>
                                               struct And<x, zero> {
                                                 typedef zero _value;
                                               };
      // ������ ��� ���������
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
      // ������� "� ������"
      // ������������� ������� � ��������� ������
      cons(val x, val y) {                     template <typename x, typename y>
        head = x;                              struct cons {
        tail = y;                                typedef x head;
      }                                          typedef y tail;
                                               };

      // ������������ ��������� �������� �������� �����
      // ��� ������������, ��� �� ������������� � C++ ��������
      // ��, ����� #type - ����������� C++ � ������ �����������
      #type T = val;
      #type unary = T -> T;

      // ��� map
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
